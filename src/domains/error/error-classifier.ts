/**
 * Error classification system for GitHub API errors
 * Maps HTTP errors and patterns to user-friendly categories with actionable messages
 */

/** Rate limit threshold for warnings */
export const RATE_LIMIT_WARNING_THRESHOLD = 100;

/** Milliseconds per minute for time calculations */
const MS_PER_MINUTE = 60000;

export type ErrorCategory =
	| "RATE_LIMIT"
	| "AUTH_MISSING"
	| "AUTH_SCOPE"
	| "REPO_ACCESS"
	| "REPO_NOT_FOUND"
	| "NETWORK"
	| "SSH_KEY"
	| "UNKNOWN";

export interface ClassifiedError {
	category: ErrorCategory;
	message: string;
	details?: string;
	suggestion?: string;
	httpStatus?: number;
}

/**
 * Input interface for GitHub error classification
 * Provides type safety for error objects
 */
export interface GitHubErrorInput {
	status?: number;
	message?: string;
	response?: {
		headers?: {
			"x-ratelimit-reset"?: string;
		};
	};
}

/**
 * Safely calculate time until reset in minutes
 * Returns null if reset time is in the past or invalid
 */
function calculateTimeUntilReset(resetTimestamp: string | undefined): number | null {
	if (!resetTimestamp) return null;

	const parsed = Number.parseInt(resetTimestamp, 10);
	if (Number.isNaN(parsed)) return null;

	const resetDate = new Date(parsed * 1000);
	const diffMs = resetDate.getTime() - Date.now();

	// Return null if reset time is in the past
	if (diffMs <= 0) return null;

	return Math.ceil(diffMs / MS_PER_MINUTE);
}

/**
 * Classify GitHub API errors by analyzing HTTP status codes and error messages
 */
export function classifyGitHubError(
	error: GitHubErrorInput | null | undefined,
	operation?: string,
): ClassifiedError {
	const status = error?.status;
	const message = error?.message ?? "";
	const messageLower = message.toLowerCase();

	// Rate limit errors (403 with specific message)
	if (
		status === 403 &&
		(messageLower.includes("rate limit") || messageLower.includes("api rate"))
	) {
		const resetTime = error?.response?.headers?.["x-ratelimit-reset"];
		const timeUntilReset = calculateTimeUntilReset(resetTime);

		return {
			category: "RATE_LIMIT",
			message: "GitHub API rate limit exceeded",
			details:
				timeUntilReset !== null
					? `Rate limit resets in ${timeUntilReset} minute${timeUntilReset === 1 ? "" : "s"}`
					: "Rate limit will reset soon",
			suggestion:
				"Wait for rate limit to reset or authenticate with a GitHub token for higher limits",
			httpStatus: 403,
		};
	}

	// Authentication missing (401)
	if (status === 401) {
		return {
			category: "AUTH_MISSING",
			message: "Not authenticated with GitHub",
			details: "GitHub CLI session may have expired or token is invalid",
			suggestion: "Re-authenticate with GitHub CLI",
			httpStatus: 401,
		};
	}

	// Authentication scope issues (403 without rate limit message)
	if (status === 403) {
		return {
			category: "AUTH_SCOPE",
			message: "GitHub token missing required permissions",
			details: "Your token may be missing the 'repo' scope or other required permissions",
			suggestion: "Re-authenticate with full permissions",
			httpStatus: 403,
		};
	}

	// Repository not found or no access (404)
	if (status === 404) {
		return {
			category: "REPO_NOT_FOUND",
			message: "Repository not found or access denied",
			details: "You may not have been invited to the repository yet",
			suggestion: "Check email for GitHub invitation and accept it",
			httpStatus: 404,
		};
	}

	// Network errors (case-insensitive patterns)
	if (
		messageLower.includes("econnrefused") ||
		messageLower.includes("etimedout") ||
		messageLower.includes("enotfound") ||
		messageLower.includes("enetunreach") ||
		messageLower.includes("econnreset") ||
		messageLower.includes("network") ||
		messageLower.includes("socket hang up") ||
		messageLower.includes("getaddrinfo")
	) {
		return {
			category: "NETWORK",
			message: "Network connection error",
			details: error?.message || "Unable to connect to GitHub API",
			suggestion: "Check your internet connection and try again",
		};
	}

	// SSH key errors (expanded patterns)
	if (
		messageLower.includes("permission denied (publickey)") ||
		messageLower.includes("host key verification failed") ||
		messageLower.includes("no matching host key") ||
		messageLower.includes("could not read from remote repository") ||
		(messageLower.includes("ssh") && messageLower.includes("denied"))
	) {
		return {
			category: "SSH_KEY",
			message: "SSH authentication failed",
			details: "SSH keys may not be configured or not added to GitHub",
			suggestion: "Add your SSH key to GitHub or use HTTPS instead",
		};
	}

	// Unknown error
	return {
		category: "UNKNOWN",
		message: operation ? `Failed to ${operation}` : "An unexpected error occurred",
		details: error?.message || "Unknown error",
		suggestion: "Check the error details and try again with --verbose flag",
		httpStatus: status,
	};
}
