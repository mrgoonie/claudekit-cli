import { execSync } from "node:child_process";
import { AuthenticationError } from "../types.js";
import { logger } from "../utils/logger.js";

export class AuthManager {
	private static token: string | null = null;
	private static ghCliInstalled: boolean | null = null;

	/**
	 * Get GitHub token from GitHub CLI (gh auth login)
	 * This is the only supported authentication method for accessing private repositories.
	 */
	static async getToken(): Promise<{ token: string; method: "gh-cli" }> {
		if (AuthManager.token) {
			return { token: AuthManager.token, method: "gh-cli" };
		}

		// Check if gh CLI is installed (cached for session performance)
		if (!AuthManager.isGhCliInstalled()) {
			throw new AuthenticationError(
				"GitHub CLI is not installed.\n\n" +
					"ClaudeKit requires GitHub CLI for accessing private repositories.\n\n" +
					"To install:\n" +
					"  macOS:   brew install gh\n" +
					"  Windows: winget install GitHub.cli\n" +
					"  Linux:   sudo apt install gh  (or see: gh.io/install)\n\n" +
					"After installing, run: gh auth login\n" +
					"Then select 'Login with a web browser' when prompted.",
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
				"Follow these steps:\n" +
				"  1. Select 'GitHub.com'\n" +
				"  2. Select 'HTTPS' (or SSH if preferred)\n" +
				"  3. Authenticate Git? → Yes\n" +
				"  4. Select 'Login with a web browser' (recommended)\n" +
				"  5. Copy the one-time code shown\n" +
				"  6. Press Enter to open browser and paste the code\n" +
				"  7. Authorize GitHub CLI\n\n" +
				"Note: Do NOT use 'Paste an authentication token' - use web browser login.",
		);
	}

	/**
	 * Check if GitHub CLI is installed (cached for session performance)
	 */
	private static isGhCliInstalled(): boolean {
		// Return cached result if available
		if (AuthManager.ghCliInstalled !== null) {
			return AuthManager.ghCliInstalled;
		}

		try {
			execSync("gh --version", {
				stdio: "ignore",
				timeout: 5000,
			});
			AuthManager.ghCliInstalled = true;
			return true;
		} catch {
			AuthManager.ghCliInstalled = false;
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
