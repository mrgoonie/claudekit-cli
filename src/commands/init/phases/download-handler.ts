/**
 * Download and extraction phase
 * Handles archive download from GitHub and extraction to temp directory
 */

import { AuthManager } from "@/domains/github/github-auth.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { DownloadManager } from "@/domains/installation/download-manager.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import type { InitContext } from "../types.js";

/**
 * Download and extract release archive
 */
export async function handleDownload(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled || !ctx.release || !ctx.kit) return ctx;

	// LOCAL FOLDER MODE: Skip download entirely
	if (ctx.isLocalFolder && ctx.extractDir) {
		logger.info("Local folder mode - skipping download");
		output.section("Using Local Folder");
		logger.success(`Source: ${ctx.extractDir}`);
		return ctx; // extractDir already set by selection handler
	}

	// Get downloadable asset
	const downloadInfo = GitHubClient.getDownloadableAsset(ctx.release);
	logger.verbose("Release info", {
		tag: ctx.release.tag_name,
		prerelease: ctx.release.prerelease,
		downloadType: downloadInfo.type,
		assetSize: downloadInfo.size,
	});

	output.section("Downloading");

	// Download asset
	const downloadManager = new DownloadManager();

	// Apply user exclude patterns if provided
	if (ctx.options.exclude && ctx.options.exclude.length > 0) {
		downloadManager.setExcludePatterns(ctx.options.exclude);
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
				url: ctx.release.tarball_url,
				name: `${ctx.kit.repo}-${ctx.release.tag_name}.tar.gz`,
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
		...ctx,
		tempDir,
		archivePath,
		extractDir,
	};
}
