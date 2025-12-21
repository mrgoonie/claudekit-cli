/**
 * Project Creation Phase
 *
 * Handles downloading, extracting and installing kit files.
 */

import { join } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { AuthManager } from "@/domains/github/github-auth.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { DownloadManager } from "@/domains/installation/download-manager.js";
import { FileMerger } from "@/domains/installation/file-merger.js";
import { ReleaseManifestLoader } from "@/domains/migration/release-manifest.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";
import { type FileTrackInfo, ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { CommandsPrefix } from "@/services/transformers/commands-prefix.js";
import {
	transformFolderPaths,
	validateFolderOptions,
} from "@/services/transformers/folder-path-transformer.js";
import { getOptimalConcurrency } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { AVAILABLE_KITS, DEFAULT_FOLDERS, type KitType, type NewCommandOptions } from "@/types";

export interface ProjectCreationResult {
	releaseTag: string;
	installedFiles: string[];
	claudeDir: string;
}

/**
 * Create project by downloading and installing kit files
 */
export async function projectCreation(
	kit: KitType,
	resolvedDir: string,
	validOptions: NewCommandOptions,
	isNonInteractive: boolean,
	prompts: PromptsManager,
): Promise<ProjectCreationResult | null> {
	const kitConfig = AVAILABLE_KITS[kit];

	// Initialize GitHub client
	const github = new GitHubClient();

	// Check repository access
	const spinner = createSpinner("Checking repository access...").start();
	logger.verbose("GitHub API check", { repo: kitConfig.repo, owner: kitConfig.owner });
	try {
		await github.checkAccess(kitConfig);
		spinner.succeed("Repository access verified");
	} catch (error: any) {
		spinner.fail("Access denied to repository");
		// Display detailed error message (includes PAT troubleshooting)
		logger.error(error.message || `Cannot access ${kitConfig.name}`);
		return null;
	}

	// Determine version selection strategy
	let selectedVersion: string | undefined = validOptions.release;

	// Validate non-interactive mode requires explicit version
	if (!selectedVersion && isNonInteractive) {
		throw new Error(
			"Interactive version selection unavailable in non-interactive mode. " +
				"Either: (1) use --release <tag> flag, or (2) set CI=false to enable interactive mode",
		);
	}

	// Interactive version selection if no explicit version and in interactive mode
	if (!selectedVersion && !isNonInteractive) {
		logger.info("Fetching available versions...");

		try {
			const versionResult = await prompts.selectVersionEnhanced({
				kit: kitConfig,
				includePrereleases: validOptions.beta,
				limit: 10,
				allowManualEntry: true,
				forceRefresh: validOptions.refresh,
			});

			if (!versionResult) {
				logger.warning("Version selection cancelled by user");
				return null;
			}

			selectedVersion = versionResult;
			logger.success(`Selected version: ${selectedVersion}`);
		} catch (error: any) {
			logger.error("Failed to fetch versions, using latest release");
			logger.debug(`Version selection error: ${error.message}`);
			// Fall back to latest (default behavior)
			selectedVersion = undefined;
		}
	}

	// Get release
	let release;
	if (selectedVersion) {
		release = await github.getReleaseByTag(kitConfig, selectedVersion);
	} else {
		if (validOptions.beta) {
			logger.info("Fetching latest beta release...");
		} else {
			logger.info("Fetching latest release...");
		}
		release = await github.getLatestRelease(kitConfig, validOptions.beta);
		// Only show "Found release" when fetching latest (user didn't select specific version)
		if (release.prerelease) {
			logger.success(`Found beta: ${release.tag_name}`);
		} else {
			logger.success(`Found: ${release.tag_name}`);
		}
	}

	// Get downloadable asset (custom asset or GitHub tarball)
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
	if (validOptions.exclude && validOptions.exclude.length > 0) {
		downloadManager.setExcludePatterns(validOptions.exclude);
	}

	const tempDir = await downloadManager.createTempDir();

	// Get authentication token for API requests
	const { token } = await AuthManager.getToken();

	let archivePath: string;
	try {
		// Try downloading the asset/tarball with authentication
		archivePath = await downloadManager.downloadFile({
			url: downloadInfo.url,
			name: downloadInfo.name,
			size: downloadInfo.size,
			destDir: tempDir,
			token, // Always pass token for private repository access
		});
	} catch (error) {
		// If asset download fails, fallback to GitHub tarball
		if (downloadInfo.type === "asset") {
			logger.warning("Asset download failed, falling back to GitHub tarball...");
			const tarballInfo = {
				type: "github-tarball" as const,
				url: release.tarball_url,
				name: `${kitConfig.repo}-${release.tag_name}.tar.gz`,
				size: 0, // Size unknown for tarball
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

	// Apply /ck: prefix if requested
	if (CommandsPrefix.shouldApplyPrefix(validOptions)) {
		await CommandsPrefix.applyPrefix(extractDir);
	}

	// Resolve folder configuration
	const foldersConfig = await ConfigManager.resolveFoldersConfig(resolvedDir, {
		docsDir: validOptions.docsDir,
		plansDir: validOptions.plansDir,
	});

	// Validate custom folder names
	validateFolderOptions(validOptions);

	// Transform folder paths if custom names are specified
	const hasCustomFolders =
		foldersConfig.docs !== DEFAULT_FOLDERS.docs || foldersConfig.plans !== DEFAULT_FOLDERS.plans;

	if (hasCustomFolders) {
		const transformResult = await transformFolderPaths(extractDir, foldersConfig, {
			verbose: logger.isVerbose(),
		});
		logger.success(
			`Transformed ${transformResult.foldersRenamed} folder(s), ` +
				`${transformResult.totalReferences} reference(s) in ${transformResult.filesTransformed} file(s)`,
		);

		// Save folder config to project for future updates
		await ConfigManager.saveProjectConfig(resolvedDir, {
			docs: foldersConfig.docs,
			plans: foldersConfig.plans,
		});
		logger.debug("Saved folder configuration to .claude/.ck.json");
	}

	output.section("Installing");
	logger.verbose("Installation target", { directory: resolvedDir });

	// Copy files to target directory
	const merger = new FileMerger();

	// Apply user exclude patterns if provided
	if (validOptions.exclude && validOptions.exclude.length > 0) {
		merger.addIgnorePatterns(validOptions.exclude);
	}

	// Clean up existing commands directory if using --prefix flag
	// This handles cases where --force is used to overwrite an existing project
	if (CommandsPrefix.shouldApplyPrefix(validOptions)) {
		await CommandsPrefix.cleanupCommandsDirectory(resolvedDir, false); // new command is never global
	}

	await merger.merge(extractDir, resolvedDir, true); // Skip confirmation for new projects

	// Write installation manifest with ownership tracking
	const claudeDir = join(resolvedDir, ".claude");
	const manifestWriter = new ManifestWriter();

	// Load release manifest if available for accurate ownership tracking
	const releaseManifest = await ReleaseManifestLoader.load(extractDir);

	// Track all installed files with ownership (use getAllInstalledFiles for individual files)
	// Only track files inside .claude/ directory for ownership metadata
	const installedFiles = merger.getAllInstalledFiles();

	// Build file tracking info list
	const filesToTrack: FileTrackInfo[] = [];
	for (const installedPath of installedFiles) {
		// Only track files inside .claude/ directory (not .opencode/, etc.)
		// Note: new command is always local mode, so this filter applies
		if (!installedPath.startsWith(".claude/")) continue;

		// Strip .claude/ prefix since claudeDir already is "resolvedDir/.claude"
		const relativePath = installedPath.replace(/^\.claude\//, "");
		const filePath = join(claudeDir, relativePath);

		// If release manifest exists and file is in it, it's CK-owned
		const manifestEntry = releaseManifest
			? ReleaseManifestLoader.findFile(releaseManifest, installedPath)
			: null;

		const ownership = manifestEntry ? "ck" : "user";

		filesToTrack.push({
			filePath,
			relativePath,
			ownership,
			installedVersion: release.tag_name,
		});
	}

	// Process files in parallel with progress indicator
	const trackingSpinner = createSpinner(`Tracking ${filesToTrack.length} installed files...`);
	trackingSpinner.start();

	const trackResult = await manifestWriter.addTrackedFilesBatch(filesToTrack, {
		concurrency: getOptimalConcurrency(),
		onProgress: (processed, total) => {
			trackingSpinner.text = `Tracking files... (${processed}/${total})`;
		},
	});

	trackingSpinner.succeed(`Tracked ${trackResult.success} files`);

	// Write manifest
	await manifestWriter.writeManifest(
		claudeDir,
		kitConfig.name,
		release.tag_name,
		"local", // new command is always local
	);

	return {
		releaseTag: release.tag_name,
		installedFiles,
		claudeDir,
	};
}
