/**
 * GitHub authentication API operations
 */
import { logger } from "@/shared/logger.js";
import { Octokit } from "@octokit/rest";
import { AuthManager } from "../github-auth.js";

let cachedOctokit: Octokit | null = null;

/**
 * Initialize Octokit client with authentication
 */
export async function getAuthenticatedClient(): Promise<Octokit> {
	if (cachedOctokit) {
		return cachedOctokit;
	}

	const { token } = await AuthManager.getToken();

	cachedOctokit = new Octokit({
		auth: token,
		userAgent: "claudekit-cli",
		request: {
			timeout: 30000, // 30 seconds
		},
	});

	return cachedOctokit;
}

/**
 * Invalidate cached authentication on 401 errors
 */
export async function invalidateAuth(): Promise<void> {
	await AuthManager.clearToken();
	cachedOctokit = null;
	logger.debug("Invalidated cached authentication due to 401 error");
}

/**
 * Reset cached client (useful for testing)
 */
export function resetClient(): void {
	cachedOctokit = null;
}
