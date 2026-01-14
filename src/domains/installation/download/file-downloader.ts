/**
 * File downloading with HTTP progress tracking
 */
import { createWriteStream, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import { createProgressBar } from "@/shared/progress-bar.js";
import { DownloadError, type GitHubReleaseAsset } from "@/types";
import { formatBytes } from "../utils/path-security.js";

/**
 * Maximum allowed download size (500MB)
 * Prevents disk exhaustion from malicious or oversized files
 */
const MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024; // 500MB

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

			// Check file size limit
			if (totalSize > MAX_DOWNLOAD_SIZE) {
				throw new DownloadError(
					`File too large: ${formatBytes(totalSize)} exceeds ${formatBytes(MAX_DOWNLOAD_SIZE)} limit`,
				);
			}

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

				// Verify download completeness BEFORE closing the stream
				if (downloadedSize !== totalSize) {
					fileStream.end();
					// Wait for stream to fully close before cleanup
					await new Promise<void>((resolve) => fileStream.once("close", resolve));
					// Clean up partial download
					try {
						rmSync(destPath, { force: true });
					} catch (cleanupError) {
						const errorMsg =
							cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
						logger.debug(`Failed to clean up partial download ${destPath}: ${errorMsg}`);
					}
					throw new DownloadError(
						`Incomplete download: received ${formatBytes(downloadedSize)} of ${formatBytes(totalSize)}`,
					);
				}

				fileStream.end();
				progressBar.complete(`Downloaded ${asset.name}`);
				return destPath;
			} catch (error) {
				fileStream.end();
				// Wait for stream to fully close before cleanup
				await new Promise<void>((resolve) => fileStream.once("close", resolve));
				// Clean up partial download on any error
				try {
					rmSync(destPath, { force: true });
				} catch (cleanupError) {
					const errorMsg =
						cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
					logger.debug(`Failed to clean up partial download ${destPath}: ${errorMsg}`);
				}
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

		// Check file size limit
		if (totalSize > MAX_DOWNLOAD_SIZE) {
			throw new DownloadError(
				`File too large: ${formatBytes(totalSize)} exceeds ${formatBytes(MAX_DOWNLOAD_SIZE)} limit`,
			);
		}

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

			// Verify download size BEFORE closing the stream (if Content-Length was provided)
			const expectedSize = Number(response.headers.get("content-length"));
			if (expectedSize > 0 && downloadedSize !== expectedSize) {
				fileStream.end();
				// Wait for stream to fully close before cleanup
				await new Promise<void>((resolve) => fileStream.once("close", resolve));
				// Clean up partial download
				try {
					rmSync(destPath, { force: true });
				} catch (cleanupError) {
					const errorMsg =
						cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
					logger.debug(`Failed to clean up partial download ${destPath}: ${errorMsg}`);
				}
				throw new DownloadError(
					`Incomplete download: received ${formatBytes(downloadedSize)} of ${formatBytes(expectedSize)}`,
				);
			}

			fileStream.end();

			if (progressBar) {
				progressBar.complete(`Downloaded ${name}`);
			} else {
				output.success(`Downloaded ${name}`);
			}
			return destPath;
		} catch (error) {
			fileStream.end();
			// Wait for stream to fully close before cleanup
			await new Promise<void>((resolve) => fileStream.once("close", resolve));
			// Clean up partial download on any error
			try {
				rmSync(destPath, { force: true });
			} catch (cleanupError) {
				const errorMsg =
					cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
				logger.debug(`Failed to clean up partial download ${destPath}: ${errorMsg}`);
			}
			throw error;
		}
	}
}
