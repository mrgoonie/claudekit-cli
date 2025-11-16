import { join, resolve } from "node:path";
import { pathExists } from "fs-extra";
import { AuthManager } from "../lib/auth.js";
import { CommandsPrefix } from "../lib/commands-prefix.js";
import { DownloadManager } from "../lib/download.js";
import { handleFreshInstallation } from "../lib/fresh-installer.js";
import { GitHubClient } from "../lib/github.js";
import { FileMerger } from "../lib/merge.js";
import { PromptsManager } from "../lib/prompts.js";
import { SkillsMigrationDetector } from "../lib/skills-detector.js";
import { SkillsMigrator } from "../lib/skills-migrator.js";
import { AVAILABLE_KITS, type UpdateCommandOptions, UpdateCommandOptionsSchema } from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { FileScanner } from "../utils/file-scanner.js";
import { logger } from "../utils/logger.js";
import { PathResolver } from "../utils/path-resolver.js";
import { createSpinner } from "../utils/safe-spinner.js";

export async function updateCommand(options: UpdateCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("🔄 ClaudeKit - Update Project");

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
			const claudeDir = validOptions.global
				? resolvedDir // Global mode: ~/.claude is the root
				: join(resolvedDir, ".claude"); // Local mode: project/.claude

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

		// Apply /ck: prefix if requested
		if (CommandsPrefix.shouldApplyPrefix(validOptions)) {
			await CommandsPrefix.applyPrefix(extractDir);
		}

		// Check for skills migration need (skip if --fresh enabled)
		if (!validOptions.fresh) {
			// Archive always contains .claude/ directory
			const newSkillsDir = join(extractDir, ".claude", "skills");
			// Current skills location differs between global and local mode
			const currentSkillsDir = validOptions.global
				? join(resolvedDir, "skills") // Global: ~/.claude/skills
				: join(resolvedDir, ".claude", "skills"); // Local: project/.claude/skills

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
				includePatterns = await prompts.promptDirectorySelection();
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

		// In global mode, merge from .claude directory contents, not the .claude directory itself
		const sourceDir = validOptions.global ? join(extractDir, ".claude") : extractDir;
		await merger.merge(sourceDir, resolvedDir, false); // Show confirmation for updates

		prompts.outro(`✨ Project updated successfully at ${resolvedDir}`);

		// Show next steps
		const protectedNote =
			customClaudeFiles.length > 0
				? "Your project has been updated with the latest version.\nProtected files (.env, .claude custom files, etc.) were not modified."
				: "Your project has been updated with the latest version.\nProtected files (.env, etc.) were not modified.";

		prompts.note(protectedNote, "Update complete");
	} catch (error) {
		if (error instanceof Error && error.message === "Merge cancelled by user") {
			logger.warning("Update cancelled");
			return;
		}
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
