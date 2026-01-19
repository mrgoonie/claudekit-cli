/**
 * Error classification system for GitHub API errors
 * Maps HTTP errors and patterns to user-friendly categories with actionable messages
 */

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
 * Classify GitHub API errors by analyzing HTTP status codes and error messages
 */
export function classifyGitHubError(error: any, operation?: string): ClassifiedError {
	const status = error?.status;
	const message = error?.message || "";
	const messageLower = message.toLowerCase();

	// Rate limit errors (403 with specific message)
	if (
		status === 403 &&
		(messageLower.includes("rate limit") || messageLower.includes("api rate"))
	) {
		const resetTime = error?.response?.headers?.["x-ratelimit-reset"];
		const resetDate = resetTime ? new Date(Number.parseInt(resetTime) * 1000) : null;
		const timeUntilReset = resetDate ? Math.ceil((resetDate.getTime() - Date.now()) / 60000) : null;

		return {
			category: "RATE_LIMIT",
			message: "GitHub API rate limit exceeded",
			details: timeUntilReset
				? `Rate limit resets in ${timeUntilReset} minutes`
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

	// Network errors
	if (
		messageLower.includes("econnrefused") ||
		messageLower.includes("etimedout") ||
		messageLower.includes("enotfound") ||
		messageLower.includes("network")
	) {
		return {
			category: "NETWORK",
			message: "Network connection error",
			details: error?.message || "Unable to connect to GitHub API",
			suggestion: "Check your internet connection and try again",
		};
	}

	// SSH key errors
	if (messageLower.includes("ssh") || messageLower.includes("permission denied (publickey)")) {
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
