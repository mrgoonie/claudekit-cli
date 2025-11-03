import { resolve } from "node:path";
import { pathExists } from "fs-extra";
import { AuthManager } from "../lib/auth.js";
import { DownloadManager } from "../lib/download.js";
import { GitHubClient } from "../lib/github.js";
import { FileMerger } from "../lib/merge.js";
import { PromptsManager } from "../lib/prompts.js";
import { AVAILABLE_KITS, type UpdateCommandOptions, UpdateCommandOptionsSchema } from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { FileScanner } from "../utils/file-scanner.js";
import { readGlobalMetadata, updateGlobalMetadata } from "../utils/global-metadata.js";
import {
	canWriteToGlobalDir,
	getGlobalInstallDir,
	getPlatformName,
} from "../utils/global-paths.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/safe-spinner.js";

export async function updateCommand(options: UpdateCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("🔄 ClaudeKit - Update Project");

	try {
		// Validate and parse options
		const validOptions = UpdateCommandOptionsSchema.parse(options);

		// Load config for defaults
		const config = await ConfigManager.get();

		// Get kit selection
		let kit = validOptions.kit || config.defaults?.kit;
		if (!kit) {
			kit = await prompts.selectKit();
		}

		const kitConfig = AVAILABLE_KITS[kit];
		logger.info(`Selected kit: ${kitConfig.name}`);

		// Determine target directory and validate
		let resolvedDir: string;
		const isGlobalInstall = validOptions.global;

		if (isGlobalInstall) {
			prompts.intro(`🌍 Installing ${kitConfig.name} globally...`);

			// Check if we can write to global directory
			const canWrite = await canWriteToGlobalDir();
			if (!canWrite) {
				logger.error("Cannot write to global installation directory.");
				logger.info("Try running with elevated privileges or check permissions.");
				return;
			}

			const globalDir = getGlobalInstallDir();
			resolvedDir = globalDir;
			logger.info(`Global installation directory: ${resolvedDir}`);
			logger.info(`Platform: ${getPlatformName()}`);

			// Check for existing global installation
			const existingMetadata = await readGlobalMetadata();
			if (existingMetadata) {
				logger.info(`Found existing global installation: ${existingMetadata.version}`);
				const shouldUpdate = await prompts.confirm(
					`Update existing global installation from ${existingMetadata.version}?`,
				);

				if (!shouldUpdate) {
					logger.info("Global installation update cancelled.");
					return;
				}
			}
		} else {
			// Regular project update
			// Get target directory
			let targetDir = validOptions.dir || config.defaults?.dir || ".";
			if (!validOptions.dir && !config.defaults?.dir) {
				targetDir = await prompts.getDirectory(targetDir);
			}

			resolvedDir = resolve(targetDir);
			logger.info(`Target directory: ${resolvedDir}`);

			// Check if directory exists
			if (!(await pathExists(resolvedDir))) {
				logger.error(`Directory does not exist: ${resolvedDir}`);
				logger.info('Use "ck new" to create a new project');
				return;
			}
		}

		// Initialize GitHub client
		const github = new GitHubClient();

		// Check repository access
		const spinner = createSpinner("Checking repository access...").start();
		const hasAccess = await github.checkAccess(kitConfig);
		if (!hasAccess) {
			spinner.fail("Access denied to repository");
			logger.error(
				`Cannot access ${kitConfig.name}. Make sure your GitHub token has access to private repositories.`,
			);
			return;
		}
		spinner.succeed("Repository access verified");

		// Get release
		let release;
		if (validOptions.version) {
			logger.info(`Fetching release version: ${validOptions.version}`);
			release = await github.getReleaseByTag(kitConfig, validOptions.version);
		} else {
			logger.info("Fetching latest release...");
			release = await github.getLatestRelease(kitConfig);
		}

		logger.success(`Found release: ${release.tag_name} - ${release.name}`);

		// Get downloadable asset (custom asset or GitHub tarball)
		const downloadInfo = GitHubClient.getDownloadableAsset(release);

		logger.info(`Download source: ${downloadInfo.type}`);
		logger.debug(`Download URL: ${downloadInfo.url}`);

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
		await downloadManager.extractArchive(archivePath, extractDir);

		// Validate extraction
		await downloadManager.validateExtraction(extractDir);

		// Identify custom .claude files to preserve (only for project updates, not global)
		let customClaudeFiles: string[] = [];
		if (!isGlobalInstall) {
			logger.info("Scanning for custom .claude files...");
			customClaudeFiles = await FileScanner.findCustomFiles(resolvedDir, extractDir, ".claude");
		}

		// Merge files with confirmation
		const merger = new FileMerger();

		// Add custom .claude files to ignore patterns
		if (customClaudeFiles.length > 0) {
			merger.addIgnorePatterns(customClaudeFiles);
			logger.success(`Protected ${customClaudeFiles.length} custom .claude file(s)`);
		}

		// Apply user exclude patterns if provided
		if (validOptions.exclude && validOptions.exclude.length > 0) {
			merger.addIgnorePatterns(validOptions.exclude);
		}

		await merger.merge(extractDir, resolvedDir, !isGlobalInstall); // Show confirmation for project updates, not global

		if (isGlobalInstall) {
			// Update global metadata
			await updateGlobalMetadata(release.tag_name, kitConfig);

			prompts.outro(`✨ ${kitConfig.name} installed globally at ${resolvedDir}`);

			// Show next steps for global installation
			const globalNote = `ClaudeKit ${kitConfig.name} ${release.tag_name} is now available globally.

Global installation directory: ${resolvedDir}
Platform: ${getPlatformName()}

You can now use ${kitConfig.name} features from any directory.`;

			prompts.note(globalNote, "Global installation complete");
		} else {
			prompts.outro(`✨ Project updated successfully at ${resolvedDir}`);

			// Show next steps for project update
			const protectedNote =
				customClaudeFiles.length > 0
					? "Your project has been updated with the latest version.\nProtected files (.env, .claude custom files, etc.) were not modified."
					: "Your project has been updated with the latest version.\nProtected files (.env, etc.) were not modified.";

			prompts.note(protectedNote, "Update complete");
		}
	} catch (error) {
		if (error instanceof Error && error.message === "Merge cancelled by user") {
			logger.warning("Update cancelled");
			return;
		}
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
