/**
 * GitHub API error handling
 */
import { GitHubError, type KitConfig } from "@/types";
import { invalidateAuth } from "./auth-api.js";

interface ErrorContext {
	kit: KitConfig;
	operation: string;
	verboseFlag?: string;
}

/**
 * Handle common HTTP errors (401, 403, 404) with consistent error messages
 */
export async function handleHttpError(error: any, context: ErrorContext): Promise<never> {
	const { kit, operation, verboseFlag = "ck new --verbose" } = context;

	if (error?.status === 401) {
		await invalidateAuth();
		throw new GitHubError(
			`Authentication failed.\n\nYour GitHub CLI session may have expired.\n\nSolution: Re-authenticate with GitHub CLI\n  gh auth login\n  (Select 'Login with a web browser' when prompted)\n\nNeed help? Run with: ${verboseFlag}`,
			401,
		);
	}

	if (error?.status === 403) {
		throw new GitHubError(
			`Access forbidden.\n\nYour GitHub CLI session may lack required permissions.\n\nSolution: Re-authenticate with GitHub CLI\n  gh auth login\n  (Select 'Login with a web browser' when prompted)\n\nNeed help? Run with: ${verboseFlag}`,
			403,
		);
	}

	if (error?.status === 404) {
		throw new GitHubError(
			`Cannot access ${kit.name} repository.\n\nPossible causes:\n  • You haven't accepted the GitHub repository invitation\n  • You're not added as a collaborator yet\n  • Repository doesn't exist\n\nSolutions:\n  1. Check email for GitHub invitation and accept it\n  2. Re-authenticate: gh auth login (select 'Login with a web browser')\n  3. Wait 2-5 minutes after accepting invitation for permissions to sync\n\nNeed help? Run with: ${verboseFlag}`,
			404,
		);
	}

	throw new GitHubError(
		`Failed to ${operation}: ${error?.message || "Unknown error"}`,
		error?.status,
	);
}
