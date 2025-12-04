import { join, resolve } from "node:path";
import { pathExists, readdir } from "fs-extra";
import { AuthManager } from "../lib/auth.js";
import { CommandsPrefix } from "../lib/commands-prefix.js";
import { DownloadManager } from "../lib/download.js";
import { transformFolderPaths, validateFolderOptions } from "../lib/folder-path-transformer.js";
import { GitHubClient } from "../lib/github.js";
import { FileMerger } from "../lib/merge.js";
import { ReleaseManifestLoader } from "../lib/migration/release-manifest.js";
import { PromptsManager } from "../lib/prompts.js";
import {
	AVAILABLE_KITS,
	DEFAULT_FOLDERS,
	type NewCommandOptions,
	NewCommandOptionsSchema,
} from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { getOptimalConcurrency } from "../utils/environment.js";
import { logger } from "../utils/logger.js";
import { type FileTrackInfo, ManifestWriter } from "../utils/manifest-writer.js";
import { processPackageInstallations } from "../utils/package-installer.js";
import { PathResolver } from "../utils/path-resolver.js";
import { createSpinner } from "../utils/safe-spinner.js";

export async function newCommand(options: NewCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("🚀 ClaudeKit - Create New Project");

	try {
		// Validate and parse options
		const validOptions = NewCommandOptionsSchema.parse(options);

		// Detect non-interactive mode
		const isNonInteractive =
			!process.stdin.isTTY || process.env.CI === "true" || process.env.NON_INTERACTIVE === "true";

		// Load config for defaults
		const config = await ConfigManager.get();

		// Get kit selection
		let kit = validOptions.kit || config.defaults?.kit;
		if (!kit) {
			if (isNonInteractive) {
				throw new Error("Kit must be specified via --kit flag in non-interactive mode");
			}
			kit = await prompts.selectKit();
		}

		const kitConfig = AVAILABLE_KITS[kit];
		logger.info(`Selected kit: ${kitConfig.name}`);

		// Get target directory
		let targetDir = validOptions.dir || config.defaults?.dir || ".";
		if (!validOptions.dir && !config.defaults?.dir) {
			if (isNonInteractive) {
				targetDir = ".";
			} else {
				targetDir = await prompts.getDirectory(targetDir);
			}
		}

		const resolvedDir = resolve(targetDir);
		logger.info(`Target directory: ${resolvedDir}`);

		// Check if directory exists and is not empty
		if (await pathExists(resolvedDir)) {
			const files = await readdir(resolvedDir);
			const isEmpty = files.length === 0;
			if (!isEmpty) {
				if (isNonInteractive) {
					if (!validOptions.force) {
						throw new Error(
							"Directory is not empty. Use --force flag to overwrite in non-interactive mode",
						);
					}
					logger.info("Directory is not empty. Proceeding with --force flag");
				} else {
					const continueAnyway = await prompts.confirm(
						"Directory is not empty. Files may be overwritten. Continue?",
					);
					if (!continueAnyway) {
						logger.warning("Operation cancelled");
						return;
					}
				}
			}
		}

		// Initialize GitHub client
		const github = new GitHubClient();

		// Check repository access
		const spinner = createSpinner("Checking repository access...").start();
		try {
			await github.checkAccess(kitConfig);
			spinner.succeed("Repository access verified");
		} catch (error: any) {
			spinner.fail("Access denied to repository");
			// Display detailed error message (includes PAT troubleshooting)
			logger.error(error.message || `Cannot access ${kitConfig.name}`);
			return;
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
					return;
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
			logger.info(`Fetching release version: ${selectedVersion}`);
			release = await github.getReleaseByTag(kitConfig, selectedVersion);
		} else {
			if (validOptions.beta) {
				logger.info("Fetching latest beta release...");
			} else {
				logger.info("Fetching latest release...");
			}
			release = await github.getLatestRelease(kitConfig, validOptions.beta);
		}

		if (release.prerelease) {
			logger.success(`Found beta release: ${release.tag_name} - ${release.name}`);
		} else {
			logger.success(`Found release: ${release.tag_name} - ${release.name}`);
		}

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

		// Handle optional package installations
		let installOpenCode = validOptions.opencode;
		let installGemini = validOptions.gemini;
		let installSkills = validOptions.installSkills;

		if (!isNonInteractive && !installOpenCode && !installGemini && !installSkills) {
			// Interactive mode: prompt for package installations
			const packageChoices = await prompts.promptPackageInstallations();
			installOpenCode = packageChoices.installOpenCode;
			installGemini = packageChoices.installGemini;

			// Prompt for skills installation
			installSkills = await prompts.promptSkillsInstallation();
		}

		// Install packages if requested
		if (installOpenCode || installGemini) {
			logger.info("Installing optional packages...");
			try {
				const installationResults = await processPackageInstallations(
					installOpenCode,
					installGemini,
				);
				prompts.showPackageInstallationResults(installationResults);
			} catch (error) {
				// Don't let package installation failures crash the entire project creation
				logger.warning(
					`Package installation failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				logger.info("You can install these packages manually later using npm install -g <package>");
			}
		}

		// Install skills dependencies if requested
		if (installSkills) {
			const { handleSkillsInstallation } = await import("../utils/package-installer.js");
			const skillsDir = PathResolver.buildSkillsPath(resolvedDir, false); // new command is never global
			await handleSkillsInstallation(skillsDir);
		}

		prompts.outro(`✨ Project created successfully at ${resolvedDir}`);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
