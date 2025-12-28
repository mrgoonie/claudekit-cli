/**
 * Shared download and extraction logic
 * Consolidates duplicate code between init and new commands
 */

import { promptForAuth } from "@/domains/github/auth-prompt.js";
import { AuthManager } from "@/domains/github/github-auth.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { DownloadManager } from "@/domains/installation/download-manager.js";
import { GitCloneManager } from "@/domains/installation/git-clone-manager.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import type { GitHubRelease, KitConfig } from "@/types";

/**
 * Options for download and extraction
 */
export interface DownloadExtractOptions {
	/** GitHub release to download */
	release: GitHubRelease;
	/** Kit configuration (for repo name in fallback) */
	kit: KitConfig;
	/** Exclude patterns for download manager */
	exclude?: string[];
	/** Use git clone instead of API download */
	useGit?: boolean;
}

/**
 * Result of download and extraction
 */
export interface DownloadExtractResult {
	/** Temporary directory containing downloaded files */
	tempDir: string;
	/** Path to downloaded archive */
	archivePath: string;
	/** Directory containing extracted files */
	extractDir: string;
}

/**
 * Download and extract a release archive
 * Used by both init and new commands
 */
export async function downloadAndExtract(
	options: DownloadExtractOptions,
): Promise<DownloadExtractResult> {
	const { release, kit, exclude, useGit } = options;

	// Use git clone if requested
	if (useGit) {
		return downloadViaGitClone(release, kit);
	}

	// Try API download, with interactive fallback on auth error
	try {
		return await downloadViaApi(release, kit, exclude);
	} catch (error) {
		// Check if it's an auth error and we're in interactive mode
		if (isAuthError(error) && process.stdin.isTTY) {
			return handleAuthErrorInteractively(error, release, kit, exclude);
		}
		throw error;
	}
}

/**
 * Check if error is an authentication error
 */
function isAuthError(error: unknown): boolean {
	if (error && typeof error === "object" && "name" in error) {
		return (error as Error).name === "AuthenticationError";
	}
	return false;
}

const MAX_AUTH_RETRIES = 3;

/**
 * Handle auth error with interactive prompt
 * Includes retry limit to prevent infinite loops
 */
async function handleAuthErrorInteractively(
	_originalError: unknown,
	release: GitHubRelease,
	kit: KitConfig,
	exclude?: string[],
	retryCount = 0,
): Promise<DownloadExtractResult> {
	// Prevent infinite loop
	if (retryCount >= MAX_AUTH_RETRIES) {
		throw new Error(
			`Authentication failed after ${MAX_AUTH_RETRIES} attempts.

Please verify your token has the correct permissions:
  • Classic PAT: requires 'repo' scope
  • Fine-grained PAT: cannot access collaborator repos

Or try: ck new --use-git`,
		);
	}

	const result = await promptForAuth();

	switch (result.method) {
		case "git":
			// User chose git clone
			logger.info("Switching to git clone method...");
			return downloadViaGitClone(release, kit);

		case "token":
			// User provided a token - set it and retry
			if (result.token) {
				process.env.GITHUB_TOKEN = result.token.trim();
				AuthManager.clearToken(); // Clear cache to pick up new token
				const attempt = retryCount + 1;
				logger.info(`Token set, retrying download (attempt ${attempt}/${MAX_AUTH_RETRIES})...`);

				try {
					return await downloadViaApi(release, kit, exclude);
				} catch (error) {
					// If still auth error, recurse with incremented counter
					if (isAuthError(error)) {
						logger.warning("Token authentication failed. Please check your token.");
						return handleAuthErrorInteractively(error, release, kit, exclude, attempt);
					}
					throw error;
				}
			}
			throw new Error("No token provided");

		case "gh-cli":
			// User needs to run gh auth login
			throw new Error(
				"Please run 'gh auth login' first, then retry the command.\n" +
					"Select 'Login with a web browser' when prompted.",
			);

		default:
			throw new Error("Authentication cancelled by user");
	}
}

/**
 * Download via git clone (uses SSH/HTTPS credentials)
 */
async function downloadViaGitClone(
	release: GitHubRelease,
	kit: KitConfig,
): Promise<DownloadExtractResult> {
	logger.verbose("Using git clone method", { tag: release.tag_name });
	output.section("Downloading (git clone)");

	// Check if git is installed
	if (!GitCloneManager.isGitInstalled()) {
		throw new Error(
			"Git is not installed.\n\n" +
				"The --use-git flag requires git to be installed.\n" +
				"Install git from: https://git-scm.com/downloads\n\n" +
				"Or remove --use-git to use GitHub API instead.",
		);
	}

	const gitCloneManager = new GitCloneManager();
	const result = await gitCloneManager.clone({
		kit,
		tag: release.tag_name,
		preferSsh: GitCloneManager.hasSshKeys(),
	});

	logger.verbose("Git clone complete", { cloneDir: result.cloneDir, method: result.method });

	return {
		tempDir: result.cloneDir,
		archivePath: "", // No archive for git clone
		extractDir: result.cloneDir, // Clone dir is the extract dir
	};
}

/**
 * Download via GitHub API (requires token)
 */
async function downloadViaApi(
	release: GitHubRelease,
	kit: KitConfig,
	exclude?: string[],
): Promise<DownloadExtractResult> {
	// Get downloadable asset
	const downloadInfo = GitHubClient.getDownloadableAsset(release);
	logger.verbose("Release info", {
		tag: release.tag_name,
		prerelease: release.prerelease,
		downloadType: downloadInfo.type,
		assetSize: downloadInfo.size,
	});

	output.section("Downloading");

	// Download asset
	const downloadManager = new DownloadManager();

	// Apply user exclude patterns if provided
	if (exclude && exclude.length > 0) {
		downloadManager.setExcludePatterns(exclude);
	}

	const tempDir = await downloadManager.createTempDir();

	// Get authentication token for API requests
	const { token } = await AuthManager.getToken();

	let archivePath: string;
	try {
		archivePath = await downloadManager.downloadFile({
			url: downloadInfo.url,
			name: downloadInfo.name,
			size: downloadInfo.size,
			destDir: tempDir,
			token,
		});
	} catch (error) {
		// If asset download fails, fallback to GitHub tarball
		if (downloadInfo.type === "asset") {
			logger.warning("Asset download failed, falling back to GitHub tarball...");
			const tarballInfo = {
				type: "github-tarball" as const,
				url: release.tarball_url,
				name: `${kit.repo}-${release.tag_name}.tar.gz`,
				size: 0,
			};

			archivePath = await downloadManager.downloadFile({
				url: tarballInfo.url,
				name: tarballInfo.name,
				size: tarballInfo.size,
				destDir: tempDir,
				token,
			});
		} else {
			throw error;
		}
	}

	// Extract archive
	const extractDir = `${tempDir}/extracted`;
	logger.verbose("Extraction", { archivePath, extractDir });
	await downloadManager.extractArchive(archivePath, extractDir);

	// Validate extraction
	await downloadManager.validateExtraction(extractDir);

	return {
		tempDir,
		archivePath,
		extractDir,
	};
}
