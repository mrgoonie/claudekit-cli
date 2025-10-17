import { resolve } from "node:path";
import { pathExists } from "fs-extra";
import ora from "ora";
import { AuthManager } from "../lib/auth.js";
import { DownloadManager } from "../lib/download.js";
import { GitHubClient } from "../lib/github.js";
import { FileMerger } from "../lib/merge.js";
import { PromptsManager } from "../lib/prompts.js";
import { AVAILABLE_KITS, type UpdateCommandOptions, UpdateCommandOptionsSchema } from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { logger } from "../utils/logger.js";

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

		// Get target directory
		let targetDir = validOptions.dir || config.defaults?.dir || ".";
		if (!validOptions.dir && !config.defaults?.dir) {
			targetDir = await prompts.getDirectory(targetDir);
		}

		const resolvedDir = resolve(targetDir);
		logger.info(`Target directory: ${resolvedDir}`);

		// Check if directory exists
		if (!(await pathExists(resolvedDir))) {
			logger.error(`Directory does not exist: ${resolvedDir}`);
			logger.info('Use "ck new" to create a new project');
			return;
		}

		// Initialize GitHub client
		const github = new GitHubClient();

		// Check repository access
		const spinner = ora("Checking repository access...").start();
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
		const tempDir = await downloadManager.createTempDir();

		// Get authentication token for API requests
		const { token } = await AuthManager.getToken();

		const archivePath = await downloadManager.downloadFile({
			url: downloadInfo.url,
			name: downloadInfo.name,
			size: downloadInfo.size,
			destDir: tempDir,
			token: downloadInfo.type !== "asset" ? token : undefined,
		});

		// Extract archive
		const extractDir = `${tempDir}/extracted`;
		await downloadManager.extractArchive(archivePath, extractDir);

		// Merge files with confirmation
		const merger = new FileMerger();
		await merger.merge(extractDir, resolvedDir, false); // Show confirmation for updates

		prompts.outro(`✨ Project updated successfully at ${resolvedDir}`);

		// Show next steps
		prompts.note(
			"Your project has been updated with the latest version.\nProtected files (.env, etc.) were not modified.",
			"Update complete",
		);
	} catch (error) {
		if (error instanceof Error && error.message === "Merge cancelled by user") {
			logger.warning("Update cancelled");
			return;
		}
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
