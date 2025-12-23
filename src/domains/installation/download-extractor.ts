/**
 * Shared download and extraction logic
 * Consolidates duplicate code between init and new commands
 */

import { AuthManager } from "@/domains/github/github-auth.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { DownloadManager } from "@/domains/installation/download-manager.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import type { GitHubRelease, KitConfig } from "@/types";

/**
 * Options for download and extraction
 */
export interface DownloadExtractOptions {
	/** GitHub release to download */
	release: GitHubRelease;
	/** Kit configuration (for repo name in fallback) */
	kit: KitConfig;
	/** Exclude patterns for download manager */
	exclude?: string[];
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
 */
export async function downloadAndExtract(
	options: DownloadExtractOptions,
): Promise<DownloadExtractResult> {
	const { release, kit, exclude } = options;

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
