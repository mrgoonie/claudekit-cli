import { resolve } from "node:path";
import { pathExists, readdir } from "fs-extra";
import ora from "ora";
import { AuthManager } from "../lib/auth.js";
import { DownloadManager } from "../lib/download.js";
import { GitHubClient } from "../lib/github.js";
import { FileMerger } from "../lib/merge.js";
import { PromptsManager } from "../lib/prompts.js";
import { AVAILABLE_KITS, type NewCommandOptions, NewCommandOptionsSchema } from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export async function newCommand(options: NewCommandOptions): Promise<void> {
	const prompts = new PromptsManager();

	prompts.intro("🚀 ClaudeKit - Create New Project");

	try {
		// Validate and parse options
		const validOptions = NewCommandOptionsSchema.parse(options);

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

		// Check if directory exists and is not empty
		if (await pathExists(resolvedDir)) {
			const files = await readdir(resolvedDir);
			const isEmpty = files.length === 0;
			if (!isEmpty) {
				const continueAnyway = await prompts.confirm(
					"Directory is not empty. Files may be overwritten. Continue?",
				);
				if (!continueAnyway) {
					logger.warning("Operation cancelled");
					return;
				}
			}
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

		// Copy files to target directory
		const merger = new FileMerger();
		await merger.merge(extractDir, resolvedDir, true); // Skip confirmation for new projects

		prompts.outro(`✨ Project created successfully at ${resolvedDir}`);

		// Show next steps
		prompts.note(
			`cd ${targetDir !== "." ? targetDir : "into the directory"}\nbun install\nbun run dev`,
			"Next steps",
		);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error occurred");
		process.exit(1);
	}
}
