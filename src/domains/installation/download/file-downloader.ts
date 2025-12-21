/**
 * File downloading with HTTP progress tracking
 */
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import { createProgressBar } from "@/shared/progress-bar.js";
import { DownloadError, type GitHubReleaseAsset } from "@/types";
import { formatBytes } from "../utils/path-security.js";

/**
 * Download file parameters
 */
export interface DownloadFileParams {
	url: string;
	name: string;
	size?: number;
	destDir: string;
	token?: string;
}

/**
 * File downloader with progress tracking
 */
export class FileDownloader {
	/**
	 * Download asset from URL with progress tracking
	 * @param asset - GitHub release asset metadata
	 * @param destDir - Destination directory
	 * @returns Path to downloaded file
	 */
	async downloadAsset(asset: GitHubReleaseAsset, destDir: string): Promise<string> {
		try {
			const destPath = join(destDir, asset.name);

			// Ensure destination directory exists
			await mkdir(destDir, { recursive: true });

			output.info(`Downloading ${asset.name} (${formatBytes(asset.size)})...`);
			logger.verbose("Download details", {
				url: asset.browser_download_url,
				size: asset.size,
				name: asset.name,
			});

			const response = await fetch(asset.browser_download_url, {
				headers: {
					Accept: "application/octet-stream",
				},
			});

			logger.verbose("HTTP response", {
				status: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers.entries()),
			});

			if (!response.ok) {
				throw new DownloadError(`Failed to download: ${response.statusText}`);
			}

			const totalSize = asset.size;
			let downloadedSize = 0;

			// Create TTY-aware progress bar
			const progressBar = createProgressBar({
				total: totalSize,
				format: "download",
				label: "Downloading",
			});

			const fileStream = createWriteStream(destPath);
			const reader = response.body?.getReader();

			if (!reader) {
				throw new DownloadError("Failed to get response reader");
			}

			try {
				while (true) {
					const { done, value } = await reader.read();

					if (done) {
						break;
					}

					fileStream.write(value);
					downloadedSize += value.length;
					progressBar.update(downloadedSize);
				}

				fileStream.end();
				progressBar.complete(`Downloaded ${asset.name}`);
				return destPath;
			} catch (error) {
				fileStream.close();
				throw error;
			}
		} catch (error) {
			throw new DownloadError(
				`Failed to download ${asset.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Download file from URL with progress tracking (supports both assets and API URLs)
	 * @param params - Download parameters
	 * @returns Path to downloaded file
	 */
	async downloadFile(params: DownloadFileParams): Promise<string> {
		const { url, name, size, destDir, token } = params;
		const destPath = join(destDir, name);

		await mkdir(destDir, { recursive: true });

		output.info(`Downloading ${name}${size ? ` (${formatBytes(size)})` : ""}...`);

		const headers: Record<string, string> = {};

		// Add authentication for GitHub API URLs
		if (token && url.includes("api.github.com")) {
			headers.Authorization = `Bearer ${token}`;
			// Use application/octet-stream for asset downloads (not vnd.github+json)
			headers.Accept = "application/octet-stream";
			headers["X-GitHub-Api-Version"] = "2022-11-28";
		} else {
			headers.Accept = "application/octet-stream";
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			throw new DownloadError(`Failed to download: ${response.statusText}`);
		}

		const totalSize = size || Number(response.headers.get("content-length")) || 0;
		let downloadedSize = 0;

		// Create TTY-aware progress bar only if we know the size
		const progressBar =
			totalSize > 0
				? createProgressBar({
						total: totalSize,
						format: "download",
						label: "Downloading",
					})
				: null;

		const fileStream = createWriteStream(destPath);
		const reader = response.body?.getReader();

		if (!reader) {
			throw new DownloadError("Failed to get response reader");
		}

		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				fileStream.write(value);
				downloadedSize += value.length;

				if (progressBar) {
					progressBar.update(downloadedSize);
				}
			}

			fileStream.end();
			if (progressBar) {
				progressBar.complete(`Downloaded ${name}`);
			} else {
				output.success(`Downloaded ${name}`);
			}
			return destPath;
		} catch (error) {
			fileStream.close();
			throw error;
		}
	}
}
