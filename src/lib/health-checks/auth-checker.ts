import { execSync } from "node:child_process";
import { AVAILABLE_KITS, type KitType } from "../../types.js";
import { AuthManager } from "../auth.js";
import { GitHubClient } from "../github.js";
import type { CheckResult, Checker, FixAction, FixResult } from "./types.js";

const isCIEnvironment = process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";

/** AuthChecker validates GitHub CLI auth, token, and repository access */
export class AuthChecker implements Checker {
	readonly group = "auth" as const;
	private kits: KitType[];

	constructor(kits: KitType[] = ["engineer"]) {
		this.kits = kits;
	}

	async run(): Promise<CheckResult[]> {
		const results: CheckResult[] = [];

		results.push(await this.checkGhAuth());
		results.push(await this.checkGhToken());

		// Repo access checks (skip in CI)
		for (const kit of this.kits) {
			results.push(await this.checkRepoAccess(kit));
		}

		return results;
	}

	private async checkGhAuth(): Promise<CheckResult> {
		// Skip in test environment to prevent hanging
		if (process.env.NODE_ENV === "test") {
			return {
				id: "gh-auth-status",
				name: "GitHub CLI Auth",
				group: "auth",
				status: "pass",
				message: "Authenticated (test mode)",
				autoFixable: false,
			};
		}

		try {
			// Use explicit -h github.com to handle multi-host configurations
			execSync("gh auth status -h github.com", {
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 5000,
			});

			return {
				id: "gh-auth-status",
				name: "GitHub CLI Auth",
				group: "auth",
				status: "pass",
				message: "Authenticated via GitHub CLI",
				autoFixable: false,
			};
		} catch {
			return {
				id: "gh-auth-status",
				name: "GitHub CLI Auth",
				group: "auth",
				status: "warn",
				message: "Not authenticated",
				suggestion: "Run: gh auth login -h github.com (select 'Login with a web browser')",
				autoFixable: true,
				fix: this.createGhAuthFix(),
			};
		}
	}

	private async checkGhToken(): Promise<CheckResult> {
		try {
			const { token } = await AuthManager.getToken();
			const maskedToken = `${token.substring(0, 8)}...`;

			return {
				id: "gh-token",
				name: "GitHub Token",
				group: "auth",
				status: "pass",
				message: "Token available",
				details: `Token: ${maskedToken}`,
				autoFixable: false,
			};
		} catch (error) {
			return {
				id: "gh-token",
				name: "GitHub Token",
				group: "auth",
				status: "fail",
				message: "Token not available",
				details: error instanceof Error ? error.message : "Unknown error",
				suggestion: "Run: gh auth login (select 'Login with a web browser')",
				autoFixable: true,
				fix: this.createGhAuthFix(),
			};
		}
	}

	private async checkRepoAccess(kit: KitType): Promise<CheckResult> {
		const kitConfig = AVAILABLE_KITS[kit];

		if (isCIEnvironment) {
			return {
				id: `repo-access-${kit}`,
				name: `Repository Access (${kit})`,
				group: "auth",
				status: "info",
				message: "Skipped in CI environment",
				autoFixable: false,
			};
		}

		try {
			const client = new GitHubClient();
			const hasAccess = await client.checkAccess(kitConfig);

			if (hasAccess) {
				return {
					id: `repo-access-${kit}`,
					name: `Repository Access (${kit})`,
					group: "auth",
					status: "pass",
					message: `Access to ${kitConfig.owner}/${kitConfig.repo}`,
					autoFixable: false,
				};
			}

			return {
				id: `repo-access-${kit}`,
				name: `Repository Access (${kit})`,
				group: "auth",
				status: "fail",
				message: `No access to ${kitConfig.owner}/${kitConfig.repo}`,
				suggestion: "Check email for GitHub invitation and accept it",
				autoFixable: false,
			};
		} catch (error) {
			return {
				id: `repo-access-${kit}`,
				name: `Repository Access (${kit})`,
				group: "auth",
				status: "fail",
				message: "Failed to check repository access",
				details: error instanceof Error ? error.message : "Unknown error",
				suggestion: "Re-authenticate: gh auth login (select 'Login with a web browser')",
				autoFixable: false,
			};
		}
	}

	private createGhAuthFix(): FixAction {
		return {
			id: "gh-auth-login",
			description: "Authenticate with GitHub CLI",
			execute: async (): Promise<FixResult> => {
				// gh auth login is interactive, can't auto-run
				return {
					success: false,
					message: "Run manually: gh auth login -h github.com (select 'Login with a web browser')",
					details: "This command requires interactive input. Use web browser login, not PAT.",
				};
			},
		};
	}
}
