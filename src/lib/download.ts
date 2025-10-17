import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import cliProgress from "cli-progress";
import ignore from "ignore";
import ora from "ora";
import * as tar from "tar";
import unzipper from "unzipper";
import {
	type ArchiveType,
	DownloadError,
	ExtractionError,
	type GitHubReleaseAsset,
} from "../types.js";
import { logger } from "../utils/logger.js";

const streamPipeline = promisify(pipeline);

export class DownloadManager {
	/**
	 * Patterns to exclude from extraction
	 */
	private static EXCLUDE_PATTERNS = [
		".git",
		".git/**",
		".github",
		".github/**",
		"node_modules",
		"node_modules/**",
		".DS_Store",
		"Thumbs.db",
		"*.log",
	];

	/**
	 * Check if file path should be excluded
	 */
	private shouldExclude(filePath: string): boolean {
		const ig = ignore().add(DownloadManager.EXCLUDE_PATTERNS);
		return ig.ignores(filePath);
	}

	/**
	 * Download asset from URL with progress tracking
	 */
	async downloadAsset(asset: GitHubReleaseAsset, destDir: string): Promise<string> {
		try {
			const destPath = join(destDir, asset.name);

			// Ensure destination directory exists
			await mkdir(destDir, { recursive: true });

			logger.info(`Downloading ${asset.name} (${this.formatBytes(asset.size)})...`);

			// Create progress bar
			const progressBar = new cliProgress.SingleBar({
				format: "Progress |{bar}| {percentage}% | {value}/{total} MB",
				barCompleteChar: "\u2588",
				barIncompleteChar: "\u2591",
				hideCursor: true,
			});

			const response = await fetch(asset.browser_download_url, {
				headers: {
					Accept: "application/octet-stream",
				},
			});

			if (!response.ok) {
				throw new DownloadError(`Failed to download: ${response.statusText}`);
			}

			const totalSize = asset.size;
			let downloadedSize = 0;

			progressBar.start(Math.round(totalSize / 1024 / 1024), 0);

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
					progressBar.update(Math.round(downloadedSize / 1024 / 1024));
				}

				fileStream.end();
				progressBar.stop();

				logger.success(`Downloaded ${asset.name}`);
				return destPath;
			} catch (error) {
				fileStream.close();
				progressBar.stop();
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
	 */
	async downloadFile(params: {
		url: string;
		name: string;
		size?: number;
		destDir: string;
		token?: string;
	}): Promise<string> {
		const { url, name, size, destDir, token } = params;
		const destPath = join(destDir, name);

		await mkdir(destDir, { recursive: true });

		logger.info(`Downloading ${name}${size ? ` (${this.formatBytes(size)})` : ""}...`);

		const headers: Record<string, string> = {};

		// Add authentication for GitHub API URLs
		if (token && url.includes("api.github.com")) {
			headers.Authorization = `Bearer ${token}`;
			headers.Accept = "application/vnd.github+json";
		} else {
			headers.Accept = "application/octet-stream";
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			throw new DownloadError(`Failed to download: ${response.statusText}`);
		}

		const totalSize = size || Number(response.headers.get("content-length")) || 0;
		let downloadedSize = 0;

		// Create progress bar only if we know the size
		const progressBar =
			totalSize > 0
				? new cliProgress.SingleBar({
						format: "Progress |{bar}| {percentage}% | {value}/{total} MB",
						barCompleteChar: "\u2588",
						barIncompleteChar: "\u2591",
						hideCursor: true,
					})
				: null;

		if (progressBar) {
			progressBar.start(Math.round(totalSize / 1024 / 1024), 0);
		}

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
					progressBar.update(Math.round(downloadedSize / 1024 / 1024));
				}
			}

			fileStream.end();
			if (progressBar) progressBar.stop();

			logger.success(`Downloaded ${name}`);
			return destPath;
		} catch (error) {
			fileStream.close();
			if (progressBar) progressBar.stop();
			throw error;
		}
	}

	/**
	 * Extract archive to destination
	 */
	async extractArchive(
		archivePath: string,
		destDir: string,
		archiveType?: ArchiveType,
	): Promise<void> {
		const spinner = ora("Extracting files...").start();

		try {
			// Detect archive type from filename if not provided
			const detectedType = archiveType || this.detectArchiveType(archivePath);

			// Ensure destination directory exists
			await mkdir(destDir, { recursive: true });

			if (detectedType === "tar.gz") {
				await this.extractTarGz(archivePath, destDir);
			} else if (detectedType === "zip") {
				await this.extractZip(archivePath, destDir);
			} else {
				throw new ExtractionError(`Unsupported archive type: ${detectedType}`);
			}

			spinner.succeed("Files extracted successfully");
		} catch (error) {
			spinner.fail("Extraction failed");
			throw new ExtractionError(
				`Failed to extract archive: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Extract tar.gz archive
	 */
	private async extractTarGz(archivePath: string, destDir: string): Promise<void> {
		await tar.extract({
			file: archivePath,
			cwd: destDir,
			strip: 1, // Strip the root directory from the archive
			filter: (path: string) => {
				// Exclude unwanted files
				const shouldInclude = !this.shouldExclude(path);
				if (!shouldInclude) {
					logger.debug(`Excluding: ${path}`);
				}
				return shouldInclude;
			},
		});
	}

	/**
	 * Extract zip archive
	 */
	private async extractZip(archivePath: string, destDir: string): Promise<void> {
		const { readdir, stat, mkdir: mkdirPromise, copyFile, rm } = await import("node:fs/promises");
		const { join: pathJoin } = await import("node:path");

		// Extract to a temporary directory first
		const tempExtractDir = `${destDir}-temp`;
		await mkdirPromise(tempExtractDir, { recursive: true });

		try {
			// Extract zip to temp directory
			await streamPipeline(createReadStream(archivePath), unzipper.Extract({ path: tempExtractDir }));

			// Find the root directory in the zip (if any)
			const entries = await readdir(tempExtractDir);

			// If there's a single root directory, strip it
			if (entries.length === 1) {
				const rootEntry = entries[0];
				const rootPath = pathJoin(tempExtractDir, rootEntry);
				const rootStat = await stat(rootPath);

				if (rootStat.isDirectory()) {
					// Move contents from the root directory to the destination
					await this.moveDirectoryContents(rootPath, destDir);
				} else {
					// Single file, just move it
					await mkdirPromise(destDir, { recursive: true });
					await copyFile(rootPath, pathJoin(destDir, rootEntry));
				}
			} else {
				// Multiple entries at root, move them all
				await this.moveDirectoryContents(tempExtractDir, destDir);
			}

			// Clean up temp directory
			await rm(tempExtractDir, { recursive: true, force: true });
		} catch (error) {
			// Clean up temp directory on error
			try {
				await rm(tempExtractDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	/**
	 * Move directory contents from source to destination, applying exclusion filters
	 */
	private async moveDirectoryContents(sourceDir: string, destDir: string): Promise<void> {
		const { readdir, stat, mkdir: mkdirPromise, copyFile } = await import("node:fs/promises");
		const { join: pathJoin, relative } = await import("node:path");

		await mkdirPromise(destDir, { recursive: true });

		const entries = await readdir(sourceDir);

		for (const entry of entries) {
			const sourcePath = pathJoin(sourceDir, entry);
			const destPath = pathJoin(destDir, entry);
			const relativePath = relative(sourceDir, sourcePath);

			// Skip excluded files
			if (this.shouldExclude(relativePath)) {
				logger.debug(`Excluding: ${relativePath}`);
				continue;
			}

			const entryStat = await stat(sourcePath);

			if (entryStat.isDirectory()) {
				// Recursively copy directory
				await this.copyDirectory(sourcePath, destPath);
			} else {
				// Copy file
				await copyFile(sourcePath, destPath);
			}
		}
	}

	/**
	 * Recursively copy directory
	 */
	private async copyDirectory(sourceDir: string, destDir: string): Promise<void> {
		const { readdir, stat, mkdir: mkdirPromise, copyFile } = await import("node:fs/promises");
		const { join: pathJoin, relative } = await import("node:path");

		await mkdirPromise(destDir, { recursive: true });

		const entries = await readdir(sourceDir);

		for (const entry of entries) {
			const sourcePath = pathJoin(sourceDir, entry);
			const destPath = pathJoin(destDir, entry);
			const relativePath = relative(sourceDir, sourcePath);

			// Skip excluded files
			if (this.shouldExclude(relativePath)) {
				logger.debug(`Excluding: ${relativePath}`);
				continue;
			}

			const entryStat = await stat(sourcePath);

			if (entryStat.isDirectory()) {
				// Recursively copy directory
				await this.copyDirectory(sourcePath, destPath);
			} else {
				// Copy file
				await copyFile(sourcePath, destPath);
			}
		}
	}

	/**
	 * Detect archive type from filename
	 */
	private detectArchiveType(filename: string): ArchiveType {
		if (filename.endsWith(".tar.gz") || filename.endsWith(".tgz")) {
			return "tar.gz";
		}
		if (filename.endsWith(".zip")) {
			return "zip";
		}
		throw new ExtractionError(`Cannot detect archive type from filename: ${filename}`);
	}

	/**
	 * Create temporary download directory
	 */
	async createTempDir(): Promise<string> {
		const tempDir = join(tmpdir(), `claudekit-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		return tempDir;
	}

	/**
	 * Format bytes to human readable string
	 */
	private formatBytes(bytes: number): string {
		if (bytes === 0) return "0 Bytes";

		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
	}
}
