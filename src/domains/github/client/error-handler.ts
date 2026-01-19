/**
 * GitHub API error handling
 */
import { classifyGitHubError, formatActions, suggestActions } from "@/domains/error/index.js";
import { GitHubError, type KitConfig } from "@/types";
import { invalidateAuth } from "./auth-api.js";

interface ErrorContext {
	kit: KitConfig;
	operation: string;
	verboseFlag?: string;
}

/**
 * Handle common HTTP errors (401, 403, 404) with consistent error messages
 * Uses the new error classification system for better error messages
 */
export async function handleHttpError(error: any, context: ErrorContext): Promise<never> {
	const { kit, operation, verboseFlag = "ck new --verbose" } = context;

	// Invalidate auth on 401 errors
	if (error?.status === 401) {
		await invalidateAuth();
	}

	// Classify the error
	const classified = classifyGitHubError(error, operation);

	// Get suggested actions
	const actions = suggestActions(classified.category);
	const formattedActions = formatActions(actions);

	// Build error message
	const messageParts: string[] = [];

	// Main error message (guard against null/undefined kit)
	if (classified.category === "REPO_NOT_FOUND" && kit?.name) {
		messageParts.push(`Cannot access ${kit.name} repository.`);
	} else {
		messageParts.push(classified.message);
	}

	// Add details if available
	if (classified.details) {
		messageParts.push(`\n${classified.details}`);
	}

	// Add suggested actions
	if (formattedActions) {
		messageParts.push(`\nSolutions:${formattedActions}`);
	}

	// Add verbose flag hint
	messageParts.push(`\nNeed help? Run with: ${verboseFlag}`);

	throw new GitHubError(messageParts.join("\n"), classified.httpStatus);
}
