import { execSync } from "node:child_process";
import * as clack from "@clack/prompts";
import { type AuthMethod, AuthenticationError } from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { logger } from "../utils/logger.js";

// Lazy load keytar to avoid loading native dependencies on systems where they're not available
let keytarModule: typeof import("keytar") | null = null;
async function getKeytar() {
	if (keytarModule) return keytarModule;
	try {
		keytarModule = await import("keytar");
		return keytarModule;
	} catch (error) {
		logger.debug("Keytar not available:", error);
		return null;
	}
}

const SERVICE_NAME = "claudekit-cli";
const ACCOUNT_NAME = "github-token";

export class AuthManager {
	private static token: string | null = null;
	private static authMethod: AuthMethod | null = null;

	/**
	 * Get GitHub token with multi-tier fallback
	 */
	static async getToken(): Promise<{ token: string; method: AuthMethod }> {
		if (AuthManager.token && AuthManager.authMethod) {
			return { token: AuthManager.token, method: AuthManager.authMethod };
		}

		// Try 1: GitHub CLI
		try {
			const token = await AuthManager.getFromGhCli();
			if (token) {
				AuthManager.token = token;
				AuthManager.authMethod = "gh-cli";
				logger.debug("Using GitHub CLI authentication");
				return { token, method: "gh-cli" };
			}
		} catch (error) {
			logger.debug("GitHub CLI not available");
		}

		// Try 2: Environment variables
		const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
		if (envToken) {
			AuthManager.token = envToken;
			AuthManager.authMethod = "env-var";
			logger.debug("Using environment variable authentication");
			return { token: envToken, method: "env-var" };
		}

		// Try 3: Config file
		try {
			const configToken = await ConfigManager.getToken();
			if (configToken) {
				AuthManager.token = configToken;
				AuthManager.authMethod = "env-var";
				logger.debug("Using config file authentication");
				return { token: configToken, method: "env-var" };
			}
		} catch (error) {
			logger.debug("No token in config file");
		}

		// Try 4: OS Keychain
		try {
			const keytar = await getKeytar();
			if (keytar) {
				const keychainToken = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
				if (keychainToken) {
					AuthManager.token = keychainToken;
					AuthManager.authMethod = "keychain";
					logger.debug("Using keychain authentication");
					return { token: keychainToken, method: "keychain" };
				}
			} else {
				logger.debug("Keychain not available on this system");
			}
		} catch (error) {
			logger.debug("No token in keychain");
		}

		// Try 5: Prompt user
		const promptedToken = await AuthManager.promptForToken();
		AuthManager.token = promptedToken;
		AuthManager.authMethod = "prompt";
		return { token: promptedToken, method: "prompt" };
	}

	/**
	 * Get token from GitHub CLI
	 */
	private static async getFromGhCli(): Promise<string | null> {
		try {
			const token = execSync("gh auth token", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "ignore"],
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
	 * Prompt user for token
	 */
	private static async promptForToken(): Promise<string> {
		const token = await clack.password({
			message: "Enter your GitHub Personal Access Token:",
			validate: (value) => {
				if (!value || value.length === 0) {
					return "Token is required";
				}
				if (!value.startsWith("ghp_") && !value.startsWith("github_pat_")) {
					return 'Invalid token format. Token should start with "ghp_" or "github_pat_"';
				}
				return;
			},
		});

		if (clack.isCancel(token)) {
			throw new AuthenticationError("Authentication cancelled by user");
		}

		// Ask if user wants to save token
		const keytar = await getKeytar();
		if (keytar) {
			const save = await clack.confirm({
				message: "Save token securely in OS keychain?",
			});

			if (save && !clack.isCancel(save)) {
				try {
					await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
					logger.success("Token saved securely in keychain");
				} catch (error) {
					logger.warning("Failed to save token to keychain");
				}
			}
		}

		return token;
	}

	/**
	 * Clear stored token
	 */
	static async clearToken(): Promise<void> {
		// Always clear in-memory token
		AuthManager.token = null;
		AuthManager.authMethod = null;

		// Try to clear from keychain (may fail in CI)
		try {
			const keytar = await getKeytar();
			if (keytar) {
				await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
				logger.success("Token cleared from keychain");
			}
		} catch (error) {
			logger.warning("Failed to clear token from keychain");
		}
	}

	/**
	 * Validate token format
	 */
	static isValidTokenFormat(token: string): boolean {
		return token.startsWith("ghp_") || token.startsWith("github_pat_");
	}
}
