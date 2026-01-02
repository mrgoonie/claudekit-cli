/**
 * Shared download and extraction logic
 * Consolidates duplicate code between init and new commands
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { promptForAuth } from "@/domains/github/auth-prompt.js";
import { AuthManager } from "@/domains/github/github-auth.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { DownloadManager } from "@/domains/installation/download-manager.js";
import { GitCloneManager } from "@/domains/installation/git-clone-manager.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import type { GitHubRelease, KitConfig } from "@/types";

/**
 * Files/directories to KEEP from git clone (matches release package contents)
 * Everything else is dev-only and gets removed
 */
const RELEASE_ALLOWLIST = [
	".claude", // Kit content (required)
	"plans", // Template directory
	"CLAUDE.md", // Project instructions
	".gitignore", // Git ignore patterns
	".repomixignore", // Repomix ignore patterns
];

/**
 * Filter git clone to match release package structure
 * Uses allowlist approach - keeps only what's in release packages
 */
async function filterGitClone(cloneDir: string): Promise<{ extractDir: string; tempDir: string }> {
	const claudeDir = path.join(cloneDir, ".claude");

	// Verify .claude directory exists (required for valid kit)
	try {
		const stat = await fs.promises.stat(claudeDir);
		if (!stat.isDirectory()) {
			throw new Error(
				".claude exists but is not a directory.\n\n" +
					"This kit may be corrupted, or the release may be malformed.",
			);
		}
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				"Repository does not contain a .claude directory.\n\n" +
					"This kit may not be a ClaudeKit project, or the release may be malformed.",
			);
		}
		throw error;
	}

	// Get all entries in clone directory
	const entries = await fs.promises.readdir(cloneDir);

	// Remove everything NOT in allowlist
	let removedCount = 0;
	for (const entry of entries) {
		if (!RELEASE_ALLOWLIST.includes(entry)) {
			const fullPath = path.join(cloneDir, entry);
			await fs.promises.rm(fullPath, { recursive: true, force: true });
			removedCount++;
		}
	}

	logger.verbose("Filtered git clone (allowlist)", {
		kept: RELEASE_ALLOWLIST.filter((p) => entries.includes(p)),
		removedCount,
		extractDir: cloneDir,
	});

	// Return clone dir as extract dir (now filtered)
	return { extractDir: cloneDir, tempDir: cloneDir };
}

/**
 * Options for download and extraction
 */
export interface DownloadExtractOptions {
	/** GitHub release to download (optional for offline methods) */
	release?: GitHubRelease;
	/** Kit configuration (for repo name in fallback) */
	kit: KitConfig;
	/** Exclude patterns for download manager */
	exclude?: string[];
	/** Use git clone instead of API download */
	useGit?: boolean;
	/** Non-interactive mode (skips prompts) */
	isNonInteractive?: boolean;
	/** Path to local archive file (zip/tar.gz) - bypasses download */
	archive?: string;
	/** Path to local kit directory - bypasses download and extraction */
	kitPath?: string;
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
 *
 * Priority order:
 * 1. --kit-path: Use local directory directly (no download, no extraction)
 * 2. --archive: Use local archive file (no download, extract only)
 * 3. --use-git: Clone via git (requires release tag)
 * 4. Default: Download via GitHub API (requires release)
 */
export async function downloadAndExtract(
	options: DownloadExtractOptions,
): Promise<DownloadExtractResult> {
	const { release, kit, exclude, useGit, isNonInteractive, archive, kitPath } = options;

	// Validate mutually exclusive options
	const offlineOptions = [useGit, archive, kitPath].filter(Boolean);
	if (offlineOptions.length > 1) {
		throw new Error(
			"Options --use-git, --archive, and --kit-path are mutually exclusive.\n" +
				"Please use only one download method.",
		);
	}

	// Option 1: Use local kit directory (skip download + extraction)
	if (kitPath) {
		return useLocalKitPath(kitPath);
	}

	// Option 2: Use local archive file (skip download, extract only)
	if (archive) {
		return extractLocalArchive(archive, exclude);
	}

	// Options 3 & 4 require a release
	if (!release) {
		throw new Error(
			"Release information is required for download.\n\n" +
				"Use --archive or --kit-path for offline installation without specifying a release.",
		);
	}

	// Option 3: Use git clone if requested
	if (useGit) {
		return downloadViaGitClone(release, kit);
	}

	// Option 4: Default - try API download, with interactive fallback on auth error
	try {
		return await downloadViaApi(release, kit, exclude);
	} catch (error) {
		// Check if it's an auth error and we're in interactive mode
		// Use isNonInteractive if provided, otherwise fall back to TTY check
		const canPrompt = isNonInteractive !== undefined ? !isNonInteractive : process.stdin.isTTY;
		if (isAuthError(error) && canPrompt) {
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

		case "cancel":
			throw new Error("Authentication cancelled by user");

		default: {
			// Exhaustiveness check - TypeScript will error if a case is missed
			const _exhaustive: never = result.method;
			throw new Error(`Unknown auth method: ${_exhaustive}`);
		}
	}
}

/**
 * Use a local kit directory directly (skip download + extraction)
 * Validates that .claude directory exists (warns but doesn't block)
 */
async function useLocalKitPath(kitPath: string): Promise<DownloadExtractResult> {
	logger.verbose("Using local kit path", { kitPath });
	output.section("Using local kit");

	// Resolve to absolute path
	const absolutePath = path.resolve(kitPath);

	// Check if path exists
	try {
		const stat = await fs.promises.stat(absolutePath);
		if (!stat.isDirectory()) {
			throw new Error(
				`--kit-path must point to a directory, not a file.\n\nProvided path: ${absolutePath}\n\nIf you meant to use an archive file, use --archive instead.`,
			);
		}
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Kit directory not found: ${absolutePath}\n\nPlease verify the path exists and is accessible.`,
			);
		}
		throw error;
	}

	// Check for .claude directory (warn if missing, don't block)
	const claudeDir = path.join(absolutePath, ".claude");
	try {
		const stat = await fs.promises.stat(claudeDir);
		if (!stat.isDirectory()) {
			logger.warning(
				`Warning: ${claudeDir} exists but is not a directory.\nThis may not be a valid ClaudeKit installation.`,
			);
		}
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			logger.warning(
				`Warning: No .claude directory found in ${absolutePath}\nThis may not be a valid ClaudeKit installation. Proceeding anyway...`,
			);
		}
	}

	logger.info(`Using kit from: ${absolutePath}`);

	return {
		tempDir: absolutePath,
		archivePath: "", // No archive for local path
		extractDir: absolutePath,
	};
}

/**
 * Extract a local archive file (skip download, extract only)
 */
async function extractLocalArchive(
	archivePath: string,
	exclude?: string[],
): Promise<DownloadExtractResult> {
	logger.verbose("Using local archive", { archivePath });
	output.section("Extracting local archive");

	// Resolve to absolute path
	const absolutePath = path.resolve(archivePath);

	// Check if archive exists
	try {
		const stat = await fs.promises.stat(absolutePath);
		if (!stat.isFile()) {
			throw new Error(
				`--archive must point to a file, not a directory.\n\nProvided path: ${absolutePath}\n\nIf you meant to use an extracted kit directory, use --kit-path instead.`,
			);
		}
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Archive file not found: ${absolutePath}\n\nPlease verify the file exists and is accessible.`,
			);
		}
		throw error;
	}

	// Create temp directory for extraction
	const downloadManager = new DownloadManager();
	const tempDir = await downloadManager.createTempDir();

	// Apply user exclude patterns if provided
	if (exclude && exclude.length > 0) {
		downloadManager.setExcludePatterns(exclude);
	}

	// Extract archive
	const extractDir = `${tempDir}/extracted`;
	logger.verbose("Extraction", { archivePath: absolutePath, extractDir });
	await downloadManager.extractArchive(absolutePath, extractDir);

	// Validate extraction
	await downloadManager.validateExtraction(extractDir);

	logger.info(`Extracted from: ${absolutePath}`);

	return {
		tempDir,
		archivePath: absolutePath,
		extractDir,
	};
}

/**
 * Download via git clone (uses SSH/HTTPS credentials)
 * Filters cloned content to only include .claude/ directory (like release packages)
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

	// Filter clone to match release package (remove dev-only files)
	const { extractDir, tempDir } = await filterGitClone(result.cloneDir);

	return {
		tempDir,
		archivePath: "", // No archive for git clone
		extractDir,
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
