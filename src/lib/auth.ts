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

		// Check if gh CLI is installed
		if (!AuthManager.isGhCliInstalled()) {
			throw new AuthenticationError(
				"GitHub CLI is not installed.\n\n" +
					"ClaudeKit requires GitHub CLI for accessing private repositories.\n\n" +
					"To install:\n" +
					"  • macOS: brew install gh\n" +
					"  • Windows: winget install GitHub.cli\n" +
					"  • Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md\n\n" +
					"After installing, run: gh auth login",
			);
		}

		const token = AuthManager.getFromGhCli();
		if (token) {
			AuthManager.token = token;
			logger.debug("Using GitHub CLI authentication");
			return { token, method: "gh-cli" };
		}

		// GitHub CLI installed but not authenticated
		throw new AuthenticationError(
			"GitHub CLI is not authenticated.\n\n" +
				"Run: gh auth login\n\n" +
				"Then follow the prompts to authenticate with your GitHub account.",
		);
	}

	/**
	 * Check if GitHub CLI is installed
	 */
	private static isGhCliInstalled(): boolean {
		try {
			execSync("gh --version", {
				stdio: "ignore",
				timeout: 5000,
			});
			return true;
		} catch {
			return false;
		}
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
	 * Clear cached token (useful for invalidating stale tokens on 401 errors)
	 */
	static async clearToken(): Promise<void> {
		AuthManager.token = null;
		logger.debug("Cleared cached token");
	}
}
