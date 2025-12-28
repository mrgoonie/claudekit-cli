import { execSync } from "node:child_process";
import { logger } from "@/shared/logger.js";
import { type AuthMethod, AuthenticationError } from "@/types";

export class AuthManager {
	private static token: string | null = null;
	private static tokenMethod: AuthMethod | null = null;
	private static ghCliInstalled: boolean | null = null;

	/**
	 * Get GitHub token from environment variables or GitHub CLI
	 * Priority: GITHUB_TOKEN → GH_TOKEN → gh auth token
	 */
	static async getToken(): Promise<{ token: string; method: AuthMethod }> {
		if (AuthManager.token && AuthManager.tokenMethod) {
			return { token: AuthManager.token, method: AuthManager.tokenMethod };
		}

		// Priority 1: Check environment variables (GITHUB_TOKEN, GH_TOKEN)
		const envToken = AuthManager.getFromEnv();
		if (envToken) {
			AuthManager.token = envToken;
			AuthManager.tokenMethod = "env";
			logger.debug("Using environment variable authentication");
			return { token: envToken, method: "env" };
		}

		// Priority 2: Check if gh CLI is installed (cached for session performance)
		if (!AuthManager.isGhCliInstalled()) {
			throw new AuthenticationError(
				"No GitHub authentication found.\n\n" +
					"ClaudeKit supports multiple authentication methods:\n\n" +
					"Option 1: Set environment variable (recommended for CI/CD)\n" +
					"  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx\n" +
					"  Create token at: github.com/settings/tokens\n" +
					"  ⚠️  Use Classic PAT with 'repo' scope (fine-grained PATs don't work for collaborator repos)\n\n" +
					"Option 2: Use git clone with SSH (recommended for security)\n" +
					"  ck new --use-git\n" +
					"  Requires SSH key added to GitHub\n\n" +
					"Option 3: Install GitHub CLI\n" +
					"  macOS:   brew install gh\n" +
					"  Windows: winget install GitHub.cli\n" +
					"  Linux:   sudo apt install gh  (or see: gh.io/install)\n" +
					"  Then run: gh auth login",
			);
		}

		const token = AuthManager.getFromGhCli();
		if (token) {
			AuthManager.token = token;
			AuthManager.tokenMethod = "gh-cli";
			logger.debug("Using GitHub CLI authentication");
			return { token, method: "gh-cli" };
		}

		// Gather diagnostic info for better error message
		const diagnostic = AuthManager.runDiagnostic();

		// GitHub CLI installed but token retrieval failed
		throw new AuthenticationError(
			`Failed to retrieve GitHub token.

Diagnostic info:
${diagnostic}

Possible causes:
  • GitHub CLI session expired or corrupted
  • Multi-account configuration issue
  • OAuth token needs refresh

Solution: Re-authenticate with GitHub CLI
  gh auth login -h github.com

Follow these steps:
  1. Select 'GitHub.com'
  2. Select 'HTTPS' (or SSH if preferred)
  3. Authenticate Git? → Yes
  4. Select 'Login with a web browser' (recommended)
  5. Copy the one-time code shown
  6. Press Enter to open browser and paste the code
  7. Authorize GitHub CLI

Note: Do NOT use 'Paste an authentication token' - use web browser login.`,
		);
	}

	/**
	 * Run diagnostic commands to gather debug information
	 */
	private static runDiagnostic(): string {
		const info: string[] = [];

		try {
			// Get gh version
			const version = execSync("gh --version", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 3000,
			})
				.split("\n")[0]
				?.trim();
			info.push(`  gh version: ${version || "unknown"}`);
		} catch {
			info.push("  gh version: failed to retrieve");
		}

		try {
			// Check auth status for github.com specifically
			const status = execSync("gh auth status -h github.com", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 5000,
			}).trim();
			// Extract key info from status
			const activeMatch = status.match(/Active account: (true|false)/);
			const tokenMatch = status.match(/Token: (\S+)/);
			const scopesMatch = status.match(/Token scopes: '([^']+)'/);

			if (activeMatch) info.push(`  Active account: ${activeMatch[1]}`);
			if (tokenMatch) info.push(`  Token present: ${tokenMatch[1] !== "none" ? "yes" : "no"}`);
			if (scopesMatch) info.push(`  Token scopes: ${scopesMatch[1]}`);
		} catch (error: any) {
			const stderr = error?.stderr?.toString()?.trim() || error?.message || "unknown error";
			info.push(`  gh auth status: ${stderr}`);
		}

		return info.join("\n");
	}

	/**
	 * Check if GitHub CLI is installed (cached for session performance)
	 */
	static isGhCliInstalled(): boolean {
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
	 * Uses explicit -h github.com to handle multi-host configurations
	 */
	private static getFromGhCli(): string | null {
		try {
			// Try with explicit github.com host first (handles multi-host configurations)
			const token = execSync("gh auth token -h github.com", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"], // Capture stderr for debugging
				timeout: 5000, // 5 second timeout to prevent hanging
			}).trim();
			if (token && token.length > 0) {
				return token;
			}
			logger.debug("gh auth token returned empty result");
			return null;
		} catch (error: any) {
			// Log stderr for debugging if available
			if (error?.stderr) {
				logger.debug(`gh auth token stderr: ${error.stderr.toString().trim()}`);
			}
			// Try without host flag as fallback (older gh versions)
			try {
				const token = execSync("gh auth token", {
					encoding: "utf-8",
					stdio: ["pipe", "pipe", "pipe"],
					timeout: 5000,
				}).trim();
				if (token && token.length > 0) {
					return token;
				}
			} catch (fallbackError: any) {
				if (fallbackError?.stderr) {
					logger.debug(`gh auth token fallback stderr: ${fallbackError.stderr.toString().trim()}`);
				}
			}
			return null;
		}
	}

	/**
	 * Get token from environment variables
	 * Checks GITHUB_TOKEN and GH_TOKEN (in that order)
	 */
	private static getFromEnv(): string | null {
		const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
		if (token && token.trim().length > 0) {
			logger.debug("Found token in environment variable");
			return token.trim();
		}
		return null;
	}

	/**
	 * Check if environment variable authentication is available
	 */
	static hasEnvToken(): boolean {
		return !!(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
	}

	/**
	 * Clear cached token (useful for invalidating stale tokens on 401 errors)
	 */
	static async clearToken(): Promise<void> {
		AuthManager.token = null;
		AuthManager.tokenMethod = null;
		logger.debug("Cleared cached token");
	}
}
