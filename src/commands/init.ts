import { join, resolve } from "node:path";
import { copy, pathExists } from "fs-extra";
import { AuthManager } from "../lib/auth.js";
import { CommandsPrefix } from "../lib/commands-prefix.js";
import { DownloadManager } from "../lib/download.js";
import { handleFreshInstallation } from "../lib/fresh-installer.js";
import { GitHubClient } from "../lib/github.js";
import { transformPathsForGlobalInstall } from "../lib/global-path-transformer.js";
import { FileMerger } from "../lib/merge.js";
import { LegacyMigration } from "../lib/migration/legacy-migration.js";
import { ReleaseManifestLoader } from "../lib/migration/release-manifest.js";
import { PromptsManager } from "../lib/prompts.js";
import { runSetupWizard } from "../lib/setup-wizard.js";
import { SkillsMigrationDetector } from "../lib/skills-detector.js";
import { SkillsMigrator } from "../lib/skills-migrator.js";
import { AVAILABLE_KITS, type UpdateCommandOptions, UpdateCommandOptionsSchema } from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { FileScanner } from "../utils/file-scanner.js";
import { logger } from "../utils/logger.js";
import { ManifestWriter } from "../utils/manifest-writer.js";
import { PathResolver } from "../utils/path-resolver.js";
import { createSpinner } from "../utils/safe-spinner.js";

export async function initCommand(options: UpdateCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("🔧 ClaudeKit - Initialize/Update Project");

	try {
		// Check if --dir was explicitly provided (before schema applies defaults)
		const explicitDir = options.dir !== undefined;

		// Validate and parse options
		const validOptions = UpdateCommandOptionsSchema.parse(options);

		// Set global flag for ConfigManager
		ConfigManager.setGlobalFlag(validOptions.global);

		// Log installation mode
		if (validOptions.global) {
			logger.info("Global mode enabled - using platform-specific user configuration");
		}

		// Detect non-interactive mode
		const isNonInteractive =
			!process.stdin.isTTY || process.env.CI === "true" || process.env.NON_INTERACTIVE === "true";

		// Load config for defaults
		const config = await ConfigManager.get();

		// Get kit selection
		let kit = validOptions.kit || config.defaults?.kit;
		if (!kit) {
			kit = await prompts.selectKit();
		}

		const kitConfig = AVAILABLE_KITS[kit];
		logger.info(`Selected kit: ${kitConfig.name}`);

		// Get target directory
		let targetDir: string;

		if (explicitDir) {
			// Explicit --dir flag takes highest priority
			targetDir = validOptions.dir;
			logger.info(`Using explicit directory: ${targetDir}`);
		} else if (validOptions.global) {
			// Global mode: use global kit directory (overrides config defaults)
			targetDir = PathResolver.getGlobalKitDir();
			logger.info(`Using global kit directory: ${targetDir}`);
		} else {
			// Local mode: use config default or current directory
			targetDir = config.defaults?.dir || ".";
			if (!config.defaults?.dir) {
				targetDir = await prompts.getDirectory(targetDir);
			}
		}

		const resolvedDir = resolve(targetDir);
		logger.info(`Target directory: ${resolvedDir}`);

		// Check if directory exists (create if global mode)
		if (!(await pathExists(resolvedDir))) {
			if (validOptions.global) {
				// Create global directory if it doesn't exist
				const { mkdir } = await import("node:fs/promises");
				await mkdir(resolvedDir, { recursive: true });
				logger.info(`Created global directory: ${resolvedDir}`);
			} else {
				logger.error(`Directory does not exist: ${resolvedDir}`);
				logger.info('Use "ck new" to create a new project');
				return;
			}
		}

		// Handle --fresh flag: completely remove .claude directory
		if (validOptions.fresh) {
			// Determine .claude directory path (global vs local mode)
			const prefix = PathResolver.getPathPrefix(validOptions.global);
			const claudeDir = prefix ? join(resolvedDir, prefix) : resolvedDir;

			const canProceed = await handleFreshInstallation(claudeDir, prompts);
			if (!canProceed) {
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

		// Transform paths for global installation
		// This replaces hardcoded .claude/ paths with ~/.claude/ in file contents
		if (validOptions.global) {
			logger.info("Transforming paths for global installation...");
			const transformResult = await transformPathsForGlobalInstall(extractDir, {
				verbose: logger.isVerbose(),
			});
			logger.success(
				`Transformed ${transformResult.totalChanges} path(s) in ${transformResult.filesTransformed} file(s)`,
			);
		}

		// Check for skills migration need (skip if --fresh enabled)
		if (!validOptions.fresh) {
			// Archive always contains .claude/ directory
			const newSkillsDir = join(extractDir, ".claude", "skills");
			// Current skills location differs between global and local mode
			const currentSkillsDir = PathResolver.buildSkillsPath(resolvedDir, validOptions.global);

			if ((await pathExists(newSkillsDir)) && (await pathExists(currentSkillsDir))) {
				logger.info("Checking for skills directory migration...");

				const migrationDetection = await SkillsMigrationDetector.detectMigration(
					newSkillsDir,
					currentSkillsDir,
				);

				if (
					migrationDetection.status === "recommended" ||
					migrationDetection.status === "required"
				) {
					logger.info("Skills migration detected");

					// Run migration
					const migrationResult = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, {
						interactive: !isNonInteractive,
						backup: true,
						dryRun: false,
					});

					if (!migrationResult.success) {
						logger.warning("Skills migration encountered errors but continuing with update");
					}
				} else {
					logger.debug("No skills migration needed");
				}
			}
		} else {
			logger.debug("Skipping skills migration (fresh installation)");
		}

		// Identify custom .claude files to preserve (skip if --fresh enabled)
		let customClaudeFiles: string[] = [];
		if (!validOptions.fresh) {
			logger.info("Scanning for custom .claude files...");
			// In global mode, both source and target are at the root level (no .claude prefix)
			const scanSourceDir = validOptions.global ? join(extractDir, ".claude") : extractDir;
			const scanTargetSubdir = validOptions.global ? "" : ".claude";
			customClaudeFiles = await FileScanner.findCustomFiles(
				resolvedDir,
				scanSourceDir,
				scanTargetSubdir,
			);
		} else {
			logger.debug("Skipping custom file scan (fresh installation)");
		}

		// Handle selective update logic
		let includePatterns: string[] = [];

		if (validOptions.only && validOptions.only.length > 0) {
			// Non-interactive mode: use --only patterns
			includePatterns = validOptions.only;
			logger.info(`Including only: ${includePatterns.join(", ")}`);
		} else if (!isNonInteractive) {
			// Interactive mode: prompt for selection
			const updateEverything = await prompts.promptUpdateMode();

			if (!updateEverything) {
				includePatterns = await prompts.promptDirectorySelection(validOptions.global);
				logger.info(`Selected directories: ${includePatterns.join(", ")}`);
			}
		}

		// Merge files with confirmation
		const merger = new FileMerger();

		// Set include patterns if specified
		if (includePatterns.length > 0) {
			merger.setIncludePatterns(includePatterns);
		}

		// Add custom .claude files to ignore patterns
		if (customClaudeFiles.length > 0) {
			merger.addIgnorePatterns(customClaudeFiles);
			logger.success(`Protected ${customClaudeFiles.length} custom .claude file(s)`);
		}

		// Apply user exclude patterns if provided
		if (validOptions.exclude && validOptions.exclude.length > 0) {
			merger.addIgnorePatterns(validOptions.exclude);
		}

		// Set global flag for settings.json variable replacement
		merger.setGlobalFlag(validOptions.global);

		// Detect legacy install and migrate if needed (required for ownership-aware cleanup)
		// For global mode, resolvedDir is already the .claude dir; for local, it contains .claude
		const claudeDir = validOptions.global ? resolvedDir : join(resolvedDir, ".claude");
		const releaseManifest = await ReleaseManifestLoader.load(extractDir);

		if (!validOptions.fresh && (await pathExists(claudeDir))) {
			const legacyDetection = await LegacyMigration.detectLegacy(claudeDir);

			if (legacyDetection.isLegacy && releaseManifest) {
				logger.info("Legacy installation detected - migrating to ownership tracking...");
				await LegacyMigration.migrate(
					claudeDir,
					releaseManifest,
					kitConfig.name,
					release.tag_name,
					!isNonInteractive, // Interactive in non-CI
				);
				logger.success("Migration complete");
			}
		}

		// Clean up existing commands directory if using --prefix flag
		// Now ownership-aware after migration
		if (CommandsPrefix.shouldApplyPrefix(validOptions)) {
			const cleanupResult = await CommandsPrefix.cleanupCommandsDirectory(
				resolvedDir,
				validOptions.global,
				{
					dryRun: validOptions.dryRun,
					forceOverwrite: validOptions.forceOverwrite,
				},
			);

			// If dry-run, display preview and exit
			if (validOptions.dryRun) {
				const { OwnershipDisplay } = await import("../lib/ui/ownership-display.js");
				OwnershipDisplay.displayOperationPreview(cleanupResult.results);
				prompts.outro("Dry-run complete. No changes were made.");
				return;
			}
		}

		// In global mode, merge from .claude directory contents, not the .claude directory itself
		const sourceDir = validOptions.global ? join(extractDir, ".claude") : extractDir;
		await merger.merge(sourceDir, resolvedDir, false); // Show confirmation for updates

		// Write installation manifest with ownership tracking
		const manifestWriter = new ManifestWriter();

		// Track all installed files with ownership (use getAllInstalledFiles for individual files)
		// Only track files inside .claude/ directory for ownership metadata
		logger.info("Tracking installed files with ownership...");
		const installedFiles = merger.getAllInstalledFiles();
		let trackedCount = 0;

		for (const installedPath of installedFiles) {
			// Only track files inside .claude/ directory (not .opencode/, etc.)
			// In global mode, sourceDir is already .claude/, so all files are valid
			if (!validOptions.global && !installedPath.startsWith(".claude/")) continue;

			// Strip .claude/ prefix since claudeDir already is "resolvedDir/.claude"
			// In global mode, paths don't have .claude/ prefix (sourceDir is already .claude/)
			const relativePath = validOptions.global
				? installedPath
				: installedPath.replace(/^\.claude\//, "");
			const filePath = join(claudeDir, relativePath);

			// If release manifest exists and file is in it, it's CK-owned
			const manifestEntry = releaseManifest
				? ReleaseManifestLoader.findFile(releaseManifest, installedPath)
				: null;

			const ownership = manifestEntry ? "ck" : "user";

			// addTrackedFile calculates checksum internally
			await manifestWriter.addTrackedFile(filePath, relativePath, ownership, release.tag_name);
			trackedCount++;
		}

		// Write manifest (claudeDir already defined above)
		await manifestWriter.writeManifest(
			claudeDir,
			kitConfig.name,
			release.tag_name,
			validOptions.global ? "global" : "local",
		);
		logger.success(`Tracked ${trackedCount} installed files with ownership`);

		// In global mode, copy CLAUDE.md from repository root
		if (validOptions.global) {
			const claudeMdSource = join(extractDir, "CLAUDE.md");
			const claudeMdDest = join(resolvedDir, "CLAUDE.md");
			if (await pathExists(claudeMdSource)) {
				// Copy CLAUDE.md on first install, preserve if exists (respects USER_CONFIG_PATTERNS)
				if (!(await pathExists(claudeMdDest))) {
					await copy(claudeMdSource, claudeMdDest);
					logger.success("Copied CLAUDE.md to global directory");
				} else {
					logger.debug("CLAUDE.md already exists in global directory (preserved)");
				}
			}
		}

		// Handle skills installation (both interactive and non-interactive modes)
		let installSkills = validOptions.installSkills;

		// Prompt for skills installation in interactive mode if not specified via flag
		if (!isNonInteractive && !installSkills) {
			installSkills = await prompts.promptSkillsInstallation();
		}

		if (installSkills) {
			const { handleSkillsInstallation } = await import("../utils/package-installer.js");
			const skillsDir = PathResolver.buildSkillsPath(resolvedDir, validOptions.global);
			await handleSkillsInstallation(skillsDir);
		}

		// Run setup wizard if .env doesn't exist and conditions are met
		if (!validOptions.skipSetup && !isNonInteractive) {
			const envPath = join(claudeDir, ".env");
			if (!(await pathExists(envPath))) {
				const shouldSetup = await prompts.confirm("Set up configuration now?");
				if (shouldSetup) {
					await runSetupWizard({
						targetDir: claudeDir,
						isGlobal: validOptions.global,
					});
				} else {
					prompts.note(
						`Create ${envPath} manually or run 'ck init' again.`,
						"Configuration skipped",
					);
				}
			}
		}

		prompts.outro(`✨ Project initialized successfully at ${resolvedDir}`);

		// Show next steps
		const protectedNote =
			customClaudeFiles.length > 0
				? "Your project has been initialized with the latest version.\nProtected files (.env, .claude custom files, etc.) were not modified."
				: "Your project has been initialized with the latest version.\nProtected files (.env, etc.) were not modified.";

		prompts.note(protectedNote, "Initialization complete");
	} catch (error) {
		if (error instanceof Error && error.message === "Merge cancelled by user") {
			logger.warning("Update cancelled");
			return;
		}
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
