import { spawnSync } from "node:child_process";
import { AuthManager } from "@/domains/github/github-auth.js";
import { GitCloneManager } from "@/domains/installation/git-clone-manager.js";
import { logger } from "@/shared/logger.js";
import type { KitType } from "@/types";
import type { CheckResult, Checker, FixAction, FixResult } from "./types.js";

/** Minimum token length for safe masking */
const MIN_TOKEN_LENGTH_FOR_MASKING = 8;

/** Default command timeout in milliseconds */
const COMMAND_TIMEOUT_MS = 5000;

/**
 * Safely mask a token for display
 * Shows first 4 chars only if token is long enough, otherwise shows asterisks
 */
function maskToken(token: string): string {
	if (!token || token.length < MIN_TOKEN_LENGTH_FOR_MASKING) {
		return "***";
	}
	return `${token.substring(0, 4)}${"*".repeat(4)}...`;
}

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

		// Import GitHub API checker functions with error handling
		let apiCheckers: {
			checkRateLimit: () => Promise<CheckResult>;
			checkTokenScopes: () => Promise<CheckResult>;
			checkRepositoryAccess: (kitType?: KitType) => Promise<CheckResult>;
		};

		try {
			apiCheckers = await import("./checkers/github-api-checker.js");
		} catch (importError) {
			logger.verbose("AuthChecker: Failed to import API checkers", { importError });
			results.push({
				id: "api-checkers-import",
				name: "API Checkers",
				group: "auth",
				status: "fail",
				message: "Failed to load API health checkers",
				details: importError instanceof Error ? importError.message : "Unknown import error",
				autoFixable: false,
			});
			// Continue with basic checks only
			results.push(this.checkEnvAuth());
			results.push(this.checkGitAvailable());
			results.push(await this.checkGhAuth());
			results.push(await this.checkGhToken());
			return results;
		}

		// Check environment variable auth first
		logger.verbose("AuthChecker: Checking environment variable auth");
		results.push(this.checkEnvAuth());

		// Check git availability (for --use-git option)
		logger.verbose("AuthChecker: Checking git availability");
		results.push(this.checkGitAvailable());

		logger.verbose("AuthChecker: Checking GitHub CLI auth status");
		results.push(await this.checkGhAuth());
		logger.verbose("AuthChecker: Checking GitHub token");
		results.push(await this.checkGhToken());

		// Run API checks in parallel for better performance
		logger.verbose("AuthChecker: Running parallel API checks");
		const [rateLimitResult, tokenScopesResult, ...repoAccessResults] = await Promise.all([
			apiCheckers.checkRateLimit(),
			apiCheckers.checkTokenScopes(),
			// Check repository access for all configured kits
			...this.kits.map((kit) => apiCheckers.checkRepositoryAccess(kit)),
		]);

		results.push(rateLimitResult);
		results.push(tokenScopesResult);
		results.push(...repoAccessResults);

		logger.verbose("AuthChecker: All auth checks complete");
		return results;
	}

	private checkEnvAuth(): CheckResult {
		const hasToken = AuthManager.hasEnvToken();
		const envVar = process.env.GITHUB_TOKEN
			? "GITHUB_TOKEN"
			: process.env.GH_TOKEN
				? "GH_TOKEN"
				: null;

		if (hasToken && envVar) {
			const token = process.env[envVar] || "";
			return {
				id: "env-token",
				name: "Environment Token",
				group: "auth",
				status: "pass",
				message: `${envVar} is set`,
				details: `Token: ${maskToken(token)}`,
				autoFixable: false,
			};
		}

		return {
			id: "env-token",
			name: "Environment Token",
			group: "auth",
			status: "info",
			message: "Not configured (optional)",
			suggestion: "Set GITHUB_TOKEN for CI/CD or when gh CLI is not available",
			autoFixable: false,
		};
	}

	private checkGitAvailable(): CheckResult {
		const gitInstalled = GitCloneManager.isGitInstalled();
		const hasSshKeys = GitCloneManager.hasSshKeys();

		if (!gitInstalled) {
			return {
				id: "git-available",
				name: "Git (for --use-git)",
				group: "auth",
				status: "info",
				message: "Git not installed",
				suggestion: "Install git to use --use-git flag: https://git-scm.com/downloads",
				autoFixable: false,
			};
		}

		if (hasSshKeys) {
			return {
				id: "git-available",
				name: "Git (for --use-git)",
				group: "auth",
				status: "pass",
				message: "Git installed, SSH keys detected",
				details: "Can use --use-git for secure cloning",
				autoFixable: false,
			};
		}

		return {
			id: "git-available",
			name: "Git (for --use-git)",
			group: "auth",
			status: "pass",
			message: "Git installed (no SSH keys)",
			details: "Will use HTTPS for --use-git",
			autoFixable: false,
		};
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
			// Use spawnSync for better error capture (stderr often contains useful info)
			logger.verbose("AuthChecker: Running 'gh auth status -h github.com' command");
			const result = spawnSync("gh", ["auth", "status", "-h", "github.com"], {
				encoding: "utf8",
				timeout: COMMAND_TIMEOUT_MS,
			});

			// gh returns non-zero exit code if not authenticated
			if (result.status !== 0 || result.error) {
				throw new Error(result.stderr || result.stdout || "Not authenticated");
			}
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

			return {
				id: "gh-token",
				name: "GitHub Token",
				group: "auth",
				status: "pass",
				message: "Token available",
				details: `Token: ${maskToken(token)}`,
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
