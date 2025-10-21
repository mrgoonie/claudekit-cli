import { resolve } from "node:path";
import { pathExists, readdir } from "fs-extra";
import { AuthManager } from "../lib/auth.js";
import { DownloadManager } from "../lib/download.js";
import { GitHubClient } from "../lib/github.js";
import { FileMerger } from "../lib/merge.js";
import { PromptsManager } from "../lib/prompts.js";
import { AVAILABLE_KITS, type NewCommandOptions, NewCommandOptionsSchema } from "../types.js";
import { ConfigManager } from "../utils/config.js";
import { logger } from "../utils/logger.js";
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
