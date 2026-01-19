/**
 * GitHub API health checks for doctor command
 * Provides detailed diagnostics about GitHub authentication and rate limits
 */

import { execSync } from "node:child_process";
import { AuthManager } from "@/domains/github/github-auth.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { logger } from "@/shared/logger.js";
import { AVAILABLE_KITS } from "@/types";
import type { CheckResult } from "../types.js";

export interface RateLimitInfo {
	remaining: number;
	total: number;
	resetTime: Date;
	resetInMinutes: number;
}

export interface TokenScopeInfo {
	scopes: string[];
	hasRepoScope: boolean;
	hasWorkflowScope: boolean;
}

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
			};
		}

		const remaining = core.remaining;
		const total = core.limit;
		const resetTime = new Date(core.reset * 1000);
		const resetInMinutes = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
		const percentUsed = Math.round(((total - remaining) / total) * 100);

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
			};
		}

		if (remaining < 100) {
			return {
				id: "github-rate-limit",
				name: "GitHub Rate Limit",
				group: "auth",
				status: "warn",
				message: `${remaining}/${total} requests remaining (${percentUsed}% used)`,
				details: `Resets in ${resetInMinutes} minutes`,
				autoFixable: false,
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

	try {
		const output = execSync("gh auth status -h github.com", {
			stdio: ["pipe", "pipe", "pipe"],
			encoding: "utf8",
			timeout: 5000,
		});

		// Parse scopes from output
		const scopeMatch = output.match(/Token scopes:\s*([^\n]+)/i);
		const scopesStr = scopeMatch?.[1]?.trim() || "";
		const scopes = scopesStr
			.split(",")
			.map((s) => s.trim())
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
		};
	}
}

/**
 * Test actual repository access
 */
export async function checkRepositoryAccess(): Promise<CheckResult> {
	// Skip in test environment and CI
	if (process.env.NODE_ENV === "test" || process.env.CI === "true") {
		return {
			id: "github-repo-access",
			name: "Repository Access",
			group: "auth",
			status: "info",
			message: "Skipped in test/CI environment",
			autoFixable: false,
		};
	}

	try {
		const client = new GitHubClient();
		const engineerKit = AVAILABLE_KITS.engineer;

		logger.verbose(`Testing access to ${engineerKit.owner}/${engineerKit.repo}`);
		const hasAccess = await client.checkAccess(engineerKit);

		if (hasAccess) {
			return {
				id: "github-repo-access",
				name: "Repository Access",
				group: "auth",
				status: "pass",
				message: `Access to ${engineerKit.owner}/${engineerKit.repo}`,
				autoFixable: false,
			};
		}

		return {
			id: "github-repo-access",
			name: "Repository Access",
			group: "auth",
			status: "fail",
			message: `No access to ${engineerKit.owner}/${engineerKit.repo}`,
			suggestion: "Check email for GitHub invitation and accept it",
			autoFixable: false,
		};
	} catch (error) {
		return {
			id: "github-repo-access",
			name: "Repository Access",
			group: "auth",
			status: "fail",
			message: "Failed to test repository access",
			details: error instanceof Error ? error.message : "Unknown error",
			suggestion: "Re-authenticate: gh auth login -h github.com",
			autoFixable: false,
		};
	}
}
