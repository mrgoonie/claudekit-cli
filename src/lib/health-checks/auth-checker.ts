import { execSync } from "node:child_process";
import { AVAILABLE_KITS, type KitType } from "../../types.js";
import { logger } from "../../utils/logger.js";
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
		logger.verbose("AuthChecker: Starting authentication checks");
		const results: CheckResult[] = [];

		logger.verbose("AuthChecker: Checking GitHub CLI auth status");
		results.push(await this.checkGhAuth());
		logger.verbose("AuthChecker: Checking GitHub token");
		results.push(await this.checkGhToken());

		// Repo access checks (skip in CI)
		for (const kit of this.kits) {
			logger.verbose(`AuthChecker: Checking repo access for kit: ${kit}`);
			results.push(await this.checkRepoAccess(kit));
		}

		logger.verbose("AuthChecker: All auth checks complete");
		return results;
	}

	private async checkGhAuth(): Promise<CheckResult> {
		// Skip in test environment to prevent hanging
		if (process.env.NODE_ENV === "test") {
			logger.verbose("AuthChecker: Skipping gh auth check in test mode");
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
			logger.verbose("AuthChecker: Running 'gh auth status -h github.com' command");
			execSync("gh auth status -h github.com", {
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 5000,
			});
			logger.verbose("AuthChecker: gh auth status succeeded");

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
		// Skip in test environment to prevent hanging
		if (process.env.NODE_ENV === "test") {
			logger.verbose("AuthChecker: Skipping gh token check in test mode");
			return {
				id: "gh-token",
				name: "GitHub Token",
				group: "auth",
				status: "pass",
				message: "Token available (test mode)",
				autoFixable: false,
			};
		}

		try {
			logger.verbose("AuthChecker: Getting GitHub token via AuthManager");
			const { token } = await AuthManager.getToken();
			logger.verbose("AuthChecker: Token retrieved successfully");
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
			logger.verbose(`AuthChecker: Skipping repo access check for ${kit} in CI`);
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
			logger.verbose(`AuthChecker: Checking access to ${kitConfig.owner}/${kitConfig.repo}`);
			const client = new GitHubClient();
			const hasAccess = await client.checkAccess(kitConfig);
			logger.verbose(`AuthChecker: Repo access check complete for ${kit}`, { hasAccess });

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
