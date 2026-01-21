/**
 * GitHub API health checks for doctor command
 * Provides detailed diagnostics about GitHub authentication and rate limits
 */

import { spawnSync } from "node:child_process";
import { RATE_LIMIT_WARNING_THRESHOLD } from "@/domains/error/error-classifier.js";
import { AuthManager } from "@/domains/github/github-auth.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { logger } from "@/shared/logger.js";
import { AVAILABLE_KITS, type KitType } from "@/types";
import type { CheckResult } from "../types.js";

/** Milliseconds per minute */
const MS_PER_MINUTE = 60000;

/** Default command timeout in milliseconds */
const COMMAND_TIMEOUT_MS = 5000;

/**
 * Check GitHub API rate limit status
 */
export async function checkRateLimit(): Promise<CheckResult> {
	// Skip in test environment
	if (process.env.NODE_ENV === "test") {
		return {
			id: "github-rate-limit",
			name: "GitHub Rate Limit",
			group: "auth",
			status: "pass",
			message: "Test mode",
			autoFixable: false,
		};
	}

	const apiEndpoint = "api.github.com/rate_limit";

	try {
		const { token } = await AuthManager.getToken();
		const response = await fetch("https://api.github.com/rate_limit", {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
			},
		});

		if (!response.ok) {
			return {
				id: "github-rate-limit",
				name: "GitHub Rate Limit",
				group: "auth",
				status: "warn",
				message: "Failed to check rate limit",
				details: `HTTP ${response.status}`,
				autoFixable: false,
				command: apiEndpoint,
			};
		}

		const data = (await response.json()) as any;
		const core = data.resources?.core;

		if (!core) {
			return {
				id: "github-rate-limit",
				name: "GitHub Rate Limit",
				group: "auth",
				status: "warn",
				message: "Rate limit data not available",
				autoFixable: false,
				command: apiEndpoint,
			};
		}

		const remaining = core.remaining ?? 0;
		const total = core.limit ?? 0;
		const resetTime = new Date(core.reset * 1000);
		const diffMs = resetTime.getTime() - Date.now();
		// Ensure reset time is not negative (could happen if reset already passed)
		const resetInMinutes = diffMs > 0 ? Math.ceil(diffMs / MS_PER_MINUTE) : 0;
		// Prevent division by zero
		const percentUsed = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0;

		if (remaining === 0) {
			return {
				id: "github-rate-limit",
				name: "GitHub Rate Limit",
				group: "auth",
				status: "fail",
				message: "Rate limit exhausted",
				details: `Resets in ${resetInMinutes} minutes`,
				suggestion: "Wait for rate limit reset or use a different GitHub token",
				autoFixable: false,
				command: apiEndpoint,
			};
		}

		if (remaining < RATE_LIMIT_WARNING_THRESHOLD) {
			return {
				id: "github-rate-limit",
				name: "GitHub Rate Limit",
				group: "auth",
				status: "warn",
				message: `${remaining}/${total} requests remaining (${percentUsed}% used)`,
				details: `Resets in ${resetInMinutes} minutes`,
				autoFixable: false,
				command: apiEndpoint,
			};
		}

		return {
			id: "github-rate-limit",
			name: "GitHub Rate Limit",
			group: "auth",
			status: "pass",
			message: `${remaining}/${total} requests remaining`,
			details: `Resets in ${resetInMinutes} minutes`,
			autoFixable: false,
			command: apiEndpoint,
		};
	} catch (error) {
		return {
			id: "github-rate-limit",
			name: "GitHub Rate Limit",
			group: "auth",
			status: "warn",
			message: "Unable to check rate limit",
			details: error instanceof Error ? error.message : "Unknown error",
			autoFixable: false,
			command: apiEndpoint,
		};
	}
}

/**
 * Check GitHub token scopes
 */
export async function checkTokenScopes(): Promise<CheckResult> {
	// Skip in test environment
	if (process.env.NODE_ENV === "test") {
		return {
			id: "github-token-scopes",
			name: "GitHub Token Scopes",
			group: "auth",
			status: "pass",
			message: "Test mode",
			autoFixable: false,
		};
	}

	const checkCommand = "gh auth status -h github.com";

	try {
		// Use spawnSync for better error capture (stderr contains auth info)
		const result = spawnSync("gh", ["auth", "status", "-h", "github.com"], {
			encoding: "utf8",
			timeout: COMMAND_TIMEOUT_MS,
		});

		// gh auth status outputs to stderr on success (weird but true)
		const output = result.stdout || result.stderr || "";

		if (result.error) {
			throw result.error;
		}

		// Parse scopes from output (gh outputs scopes with single quotes like 'repo')
		const scopeMatch = output.match(/Token scopes:\s*([^\n]+)/i);
		const scopesStr = scopeMatch?.[1]?.trim() || "";
		const scopes = scopesStr
			.split(",")
			.map((s) => s.trim().replace(/'/g, ""))
			.filter((s) => s.length > 0);

		const hasRepoScope = scopes.includes("repo");

		if (!hasRepoScope) {
			return {
				id: "github-token-scopes",
				name: "GitHub Token Scopes",
				group: "auth",
				status: "warn",
				message: "Missing 'repo' scope",
				details: `Current scopes: ${scopes.join(", ") || "none"}`,
				suggestion:
					"Re-authenticate: gh auth login -h github.com (select 'Login with a web browser')",
				autoFixable: false,
				command: checkCommand,
			};
		}

		const details = scopes.length > 0 ? `Scopes: ${scopes.join(", ")}` : "No scopes found";

		return {
			id: "github-token-scopes",
			name: "GitHub Token Scopes",
			group: "auth",
			status: "pass",
			message: "Token has required scopes",
			details,
			autoFixable: false,
			command: checkCommand,
		};
	} catch (error) {
		return {
			id: "github-token-scopes",
			name: "GitHub Token Scopes",
			group: "auth",
			status: "warn",
			message: "Unable to check token scopes",
			details: error instanceof Error ? error.message : "Unknown error",
			suggestion: "Run: gh auth status -h github.com",
			autoFixable: false,
			command: checkCommand,
		};
	}
}

/**
 * Test actual repository access
 * @param kitType - Optional kit type to check access for. Defaults to 'engineer'.
 */
export async function checkRepositoryAccess(kitType: KitType = "engineer"): Promise<CheckResult> {
	// Skip in test environment and CI
	if (process.env.NODE_ENV === "test" || process.env.CI === "true") {
		return {
			id: `github-repo-access-${kitType}`,
			name: `Repository Access (${kitType})`,
			group: "auth",
			status: "info",
			message: "Skipped in test/CI environment",
			autoFixable: false,
		};
	}

	const kitConfig = AVAILABLE_KITS[kitType];

	// Guard against undefined kit config
	if (!kitConfig) {
		return {
			id: `github-repo-access-${kitType}`,
			name: `Repository Access (${kitType})`,
			group: "auth",
			status: "fail",
			message: `Unknown kit type: ${kitType}`,
			suggestion: `Available kits: ${Object.keys(AVAILABLE_KITS).join(", ")}`,
			autoFixable: false,
		};
	}

	try {
		const client = new GitHubClient();

		logger.verbose(`Testing access to ${kitConfig.owner}/${kitConfig.repo}`);
		const hasAccess = await client.checkAccess(kitConfig);

		if (hasAccess) {
			return {
				id: `github-repo-access-${kitType}`,
				name: `Repository Access (${kitType})`,
				group: "auth",
				status: "pass",
				message: `Access to ${kitConfig.owner}/${kitConfig.repo}`,
				autoFixable: false,
			};
		}

		return {
			id: `github-repo-access-${kitType}`,
			name: `Repository Access (${kitType})`,
			group: "auth",
			status: "fail",
			message: `No access to ${kitConfig.owner}/${kitConfig.repo}`,
			suggestion: "Check email for GitHub invitation and accept it",
			autoFixable: false,
		};
	} catch (error) {
		return {
			id: `github-repo-access-${kitType}`,
			name: `Repository Access (${kitType})`,
			group: "auth",
			status: "fail",
			message: "Failed to test repository access",
			details: error instanceof Error ? error.message : "Unknown error",
			suggestion: "Re-authenticate: gh auth login -h github.com",
			autoFixable: false,
		};
	}
}
