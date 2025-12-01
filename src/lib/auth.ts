import { execSync } from "node:child_process";
import { AuthenticationError } from "../types.js";
import { logger } from "../utils/logger.js";

export class AuthManager {
	private static token: string | null = null;

	/**
	 * Get GitHub token from GitHub CLI (gh auth login)
	 * This is the only supported authentication method for accessing private repositories.
	 */
	static async getToken(): Promise<{ token: string; method: "gh-cli" }> {
		if (AuthManager.token) {
			return { token: AuthManager.token, method: "gh-cli" };
		}

		const token = AuthManager.getFromGhCli();
		if (token) {
			AuthManager.token = token;
			logger.debug("Using GitHub CLI authentication");
			return { token, method: "gh-cli" };
		}

		// GitHub CLI not available or not authenticated
		throw new AuthenticationError(
			"GitHub CLI authentication required.\n\n" +
				"ClaudeKit requires GitHub CLI for accessing private repositories.\n" +
				"Personal Access Tokens (PAT) are no longer supported.\n\n" +
				"To authenticate:\n" +
				"  1. Install GitHub CLI: https://cli.github.com\n" +
				"  2. Run: gh auth login\n" +
				"  3. Follow the prompts to authenticate\n\n" +
				"After authenticating, run your ClaudeKit command again.",
		);
	}

	/**
	 * Get token from GitHub CLI
	 */
	private static getFromGhCli(): string | null {
		try {
			const token = execSync("gh auth token", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "ignore"],
				timeout: 5000, // 5 second timeout to prevent hanging
			}).trim();
			if (token && token.length > 0) {
				return token;
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Clear cached token (for testing purposes)
	 */
	static async clearToken(): Promise<void> {
		AuthManager.token = null;
		logger.debug("Cleared cached token");
	}
}
