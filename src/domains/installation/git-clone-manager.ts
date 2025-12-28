/**
 * Git Clone Manager
 *
 * Handles downloading kit releases via git clone instead of GitHub API.
 * Uses native git credentials (SSH keys, credential managers) for authentication.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "@/shared/logger.js";
import type { KitConfig } from "@/types";

export interface GitCloneOptions {
	/** Kit configuration */
	kit: KitConfig;
	/** Git tag to clone (e.g., v1.0.0) */
	tag: string;
	/** Prefer SSH URL over HTTPS */
	preferSsh?: boolean;
	/** Timeout in milliseconds (default: 60000) */
	timeout?: number;
}

export interface GitCloneResult {
	/** Path to cloned directory */
	cloneDir: string;
	/** URL used for cloning */
	url: string;
	/** Method used (ssh or https) */
	method: "ssh" | "https";
}

export class GitCloneManager {
	private tempBaseDir: string;

	constructor() {
		// Use system temp or fallback to ~/.claudekit/tmp
		this.tempBaseDir =
			process.env.TMPDIR ||
			process.env.TEMP ||
			path.join(process.env.HOME || "~", ".claudekit", "tmp");
	}

	/**
	 * Clone a kit repository at a specific tag
	 */
	async clone(options: GitCloneOptions): Promise<GitCloneResult> {
		const { kit, tag, preferSsh = true, timeout = 60000 } = options;

		// Ensure temp directory exists with proper error handling
		try {
			await fs.promises.mkdir(this.tempBaseDir, { recursive: true });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Failed to create temp directory: ${this.tempBaseDir}
Error: ${msg}

Check disk space and directory permissions.`,
			);
		}

		// Create unique temp directory for this clone
		const tempDir = await fs.promises.mkdtemp(path.join(this.tempBaseDir, `ck-git-${kit.repo}-`));

		// Build clone URL
		const url = preferSsh
			? `git@github.com:${kit.owner}/${kit.repo}.git`
			: `https://github.com/${kit.owner}/${kit.repo}.git`;

		const method = preferSsh ? "ssh" : "https";

		logger.verbose("Git clone", { url, tag, tempDir, method });

		try {
			// Clone with depth 1 for speed, specific tag
			// Quote paths to handle spaces in directory names (common on Windows)
			const quotedUrl = `"${url}"`;
			const quotedDir = `"${tempDir}"`;

			execSync(`git clone --depth 1 --branch "${tag}" ${quotedUrl} ${quotedDir}`, {
				stdio: ["pipe", "pipe", "pipe"],
				timeout,
				encoding: "utf-8",
			});

			// Remove .git directory to make it a clean copy
			const gitDir = path.join(tempDir, ".git");
			await fs.promises.rm(gitDir, { recursive: true, force: true });

			logger.debug(`Git clone successful: ${tempDir}`);

			return {
				cloneDir: tempDir,
				url,
				method,
			};
		} catch (error: unknown) {
			// Clean up temp directory on failure
			await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});

			// If SSH failed, suggest HTTPS or provide helpful error
			const errorMessage = error instanceof Error ? error.message : String(error);
			const stderr = (error as { stderr?: string })?.stderr || "";

			if (
				preferSsh &&
				(stderr.includes("Permission denied") || stderr.includes("Host key verification"))
			) {
				logger.debug("SSH clone failed, user may need to add SSH key to GitHub");
				throw new Error(
					`Git clone failed: SSH authentication error.\n\nYour SSH key may not be configured for GitHub.\n\nSolutions:\n  1. Add your SSH key to GitHub: github.com/settings/keys\n  2. Use HTTPS instead: ck new --use-git=https\n  3. Use GitHub CLI: gh auth login\n\nOriginal error: ${stderr || errorMessage}`,
				);
			}

			throw new Error(
				`Git clone failed: ${stderr || errorMessage}\n\nEnsure you have access to the repository and your git credentials are configured.`,
			);
		}
	}

	/**
	 * Check if git is installed and accessible
	 */
	static isGitInstalled(): boolean {
		try {
			execSync("git --version", { stdio: "ignore", timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check if SSH is likely configured for GitHub
	 * (by checking for common SSH key files)
	 */
	static hasSshKeys(): boolean {
		const sshDir = path.join(process.env.HOME || "~", ".ssh");
		const keyFiles = ["id_rsa", "id_ed25519", "id_ecdsa"];

		try {
			for (const keyFile of keyFiles) {
				if (fs.existsSync(path.join(sshDir, keyFile))) {
					return true;
				}
			}
		} catch {
			// Ignore errors accessing .ssh directory
		}

		return false;
	}

	/**
	 * Test GitHub SSH connectivity
	 */
	static async testSshConnection(): Promise<boolean> {
		try {
			// ssh -T git@github.com returns exit code 1 even on success
			// but the output contains "successfully authenticated"
			execSync("ssh -T git@github.com 2>&1 || true", {
				encoding: "utf-8",
				timeout: 10000,
			});
			return true;
		} catch {
			return false;
		}
	}
}
