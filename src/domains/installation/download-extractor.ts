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
import { resolveKitLayout } from "@/shared/kit-layout.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import type { GitHubRelease, KitConfig, KitLayout } from "@/types";

/**
 * Files/directories to KEEP from git clone (matches release package contents)
 * Everything else is dev-only and gets removed
 */
const RELEASE_ROOT_ALLOWLIST = [
	"plans",
	"CLAUDE.md",
	"AGENTS.md",
	".gitignore",
	".repomixignore",
	".mcp.json",
	".opencode",
	"release-manifest.json",
];

const NESTED_KIT_ROOT_MAX_LEVELS = 5;
const IGNORED_WRAPPER_ENTRY_NAMES = new Set([".DS_Store", "__MACOSX"]);

function buildReleaseAllowlist(layout: KitLayout): string[] {
	return [...new Set([layout.sourceDir, ...RELEASE_ROOT_ALLOWLIST])];
}

async function ensureLayoutSourceDir(
	projectRoot: string,
	layout: KitLayout,
	strict: boolean,
): Promise<string | null> {
	const sourceDir = path.join(projectRoot, layout.sourceDir);

	try {
		const stat = await fs.promises.stat(sourceDir);
		if (!stat.isDirectory()) {
			throw new Error(
				`Expected source directory "${layout.sourceDir}" exists but is not a directory.`,
			);
		}
		return sourceDir;
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			if (strict) {
				throw new Error(
					`Repository does not contain the expected kit source directory "${layout.sourceDir}".\n\nThis kit may be corrupted, or the release may be malformed.`,
				);
			}

			logger.warning(
				`Warning: No ${layout.sourceDir} source directory found in ${projectRoot}\nThis may not be a valid ClaudeKit installation. Proceeding anyway...`,
			);
			return null;
		}

		throw error;
	}
}

async function materializeRuntimeLayoutInPlace(
	projectRoot: string,
	layout: KitLayout,
): Promise<void> {
	if (layout.sourceDir === layout.runtimeDir) {
		return;
	}

	const sourceDir = path.join(projectRoot, layout.sourceDir);
	const runtimeDir = path.join(projectRoot, layout.runtimeDir);
	await fs.promises.rm(runtimeDir, { recursive: true, force: true });
	await fs.promises.rename(sourceDir, runtimeDir);
}

function isIgnoredWrapperEntry(entryName: string): boolean {
	const normalizedName = entryName.toLowerCase();
	return (
		IGNORED_WRAPPER_ENTRY_NAMES.has(entryName) ||
		normalizedName === "thumbs.db" ||
		normalizedName === "desktop.ini" ||
		entryName.startsWith("._")
	);
}

async function listVisibleEntries(projectRoot: string): Promise<fs.Dirent[]> {
	return (await fs.promises.readdir(projectRoot, { withFileTypes: true })).filter(
		(entry) => !isIgnoredWrapperEntry(entry.name),
	);
}

function isLikelyKitRoot(projectRoot: string, entries: fs.Dirent[]): boolean {
	const entrySet = new Set(entries.map((entry) => entry.name));
	const layout = resolveKitLayout(projectRoot);

	return (
		entrySet.has("CLAUDE.md") ||
		entrySet.has(layout.runtimeDir) ||
		entrySet.has(layout.sourceDir) ||
		entrySet.has("claude")
	);
}

async function resolveOfflineKitRoot(rootDir: string): Promise<string> {
	let currentDir = rootDir;

	for (let level = 0; level < NESTED_KIT_ROOT_MAX_LEVELS; level++) {
		const entries = await listVisibleEntries(currentDir);
		if (isLikelyKitRoot(currentDir, entries)) {
			return currentDir;
		}

		const childDirectories = entries.filter((entry) => entry.isDirectory());

		if (entries.length !== 1 || childDirectories.length !== 1) {
			break;
		}

		currentDir = path.join(currentDir, childDirectories[0].name);
	}

	return rootDir;
}

async function stageLocalKitPathForRuntimeLayout(
	kitRoot: string,
	layout: KitLayout,
): Promise<{ extractDir: string; tempDir: string } | null> {
	const sourceDir = await ensureLayoutSourceDir(kitRoot, layout, false);
	if (!sourceDir) {
		return null;
	}

	const downloadManager = new DownloadManager();
	const tempDir = await downloadManager.createTempDir();
	const extractDir = `${tempDir}/extracted`;
	await fs.promises.mkdir(extractDir, { recursive: true });

	const entries = await fs.promises.readdir(kitRoot);
	const allowlist = buildReleaseAllowlist(layout);

	for (const entry of entries) {
		if (!allowlist.includes(entry) || entry === layout.sourceDir) {
			continue;
		}

		await fs.promises.cp(path.join(kitRoot, entry), path.join(extractDir, entry), {
			recursive: true,
		});
	}

	const runtimeDir = path.join(extractDir, layout.runtimeDir);
	await fs.promises.mkdir(path.dirname(runtimeDir), { recursive: true });
	await fs.promises.cp(sourceDir, runtimeDir, { recursive: true });

	logger.verbose("Staged local kit path with runtime layout", {
		kitRoot,
		extractDir,
		sourceDir: layout.sourceDir,
		runtimeDir: layout.runtimeDir,
	});

	return { extractDir, tempDir };
}

/**
 * Filter git clone to match release package structure
 * Uses allowlist approach - keeps only what's in release packages
 */
async function filterGitClone(cloneDir: string): Promise<{ extractDir: string; tempDir: string }> {
	const layout = resolveKitLayout(cloneDir);
	await ensureLayoutSourceDir(cloneDir, layout, true);

	// Get all entries in clone directory
	const entries = await fs.promises.readdir(cloneDir);
	const releaseAllowlist = buildReleaseAllowlist(layout);

	// Remove everything NOT in allowlist
	let removedCount = 0;
	for (const entry of entries) {
		if (!releaseAllowlist.includes(entry)) {
			const fullPath = path.join(cloneDir, entry);
			await fs.promises.rm(fullPath, { recursive: true, force: true });
			removedCount++;
		}
	}

	await materializeRuntimeLayoutInPlace(cloneDir, layout);

	logger.verbose("Filtered git clone (allowlist)", {
		kept: releaseAllowlist.filter((p) => entries.includes(p)),
		removedCount,
		extractDir: cloneDir,
		sourceDir: layout.sourceDir,
		runtimeDir: layout.runtimeDir,
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

	const kitRoot = await resolveOfflineKitRoot(absolutePath);
	if (kitRoot !== absolutePath) {
		logger.info(`Detected nested kit root: ${kitRoot}`);
	}

	const layout = resolveKitLayout(kitRoot);
	if (layout.sourceDir !== layout.runtimeDir) {
		const stagedKit = await stageLocalKitPathForRuntimeLayout(kitRoot, layout);
		if (stagedKit) {
			logger.info(`Using kit from: ${kitRoot}`);
			return {
				tempDir: stagedKit.tempDir,
				archivePath: "",
				extractDir: stagedKit.extractDir,
			};
		}
	}

	// Check for .claude directory (warn if missing, don't block)
	const claudeDir = path.join(kitRoot, layout.runtimeDir);
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
				`Warning: No ${layout.runtimeDir} directory found in ${kitRoot}\nThis may not be a valid ClaudeKit installation. Proceeding anyway...`,
			);
		}
	}

	logger.info(`Using kit from: ${kitRoot}`);

	return {
		tempDir: absolutePath,
		archivePath: "", // No archive for local path
		extractDir: kitRoot,
	};
}

const VALID_ARCHIVE_FORMATS = [".zip", ".tar.gz", ".tgz", ".tar"];

/**
 * Validate that the archive format is supported
 * @throws {Error} If format is unsupported
 */
function validateArchiveFormat(archivePath: string): void {
	const lowerPath = archivePath.toLowerCase();
	const isValid = VALID_ARCHIVE_FORMATS.some((ext) => lowerPath.endsWith(ext));

	if (!isValid) {
		const ext = path.extname(archivePath) || "(no extension)";
		throw new Error(
			`Unsupported archive format: ${ext}\n\n` +
				`Supported formats: ${VALID_ARCHIVE_FORMATS.join(", ")}`,
		);
	}
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

	// Validate archive format before attempting extraction
	validateArchiveFormat(absolutePath);

	// Check if archive exists
	try {
		const stat = await fs.promises.stat(absolutePath);
		if (!stat.isFile()) {
			throw new Error(
				`--archive must point to a file, not a directory.\n\nProvided path: ${absolutePath}\n\nIf you meant to use an extracted kit directory, use --kit-path instead.`,
			);
		}

		// Check if archive is empty
		if (stat.size === 0) {
			throw new Error(
				`Archive file is empty: ${absolutePath}\n\nThe file exists but contains no data. Please verify the archive is not corrupted.`,
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

	const kitRoot = await resolveOfflineKitRoot(extractDir);
	if (kitRoot !== extractDir) {
		logger.info(`Detected nested kit root in archive: ${kitRoot}`);
	}

	const layout = resolveKitLayout(kitRoot);
	if (
		layout.sourceDir !== layout.runtimeDir &&
		(await ensureLayoutSourceDir(kitRoot, layout, false))
	) {
		await materializeRuntimeLayoutInPlace(kitRoot, layout);
	}

	// Validate extraction
	await downloadManager.validateExtraction(kitRoot);

	logger.info(`Extracted from: ${absolutePath}`);

	return {
		tempDir,
		archivePath: absolutePath,
		extractDir: kitRoot,
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
