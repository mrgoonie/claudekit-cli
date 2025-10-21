import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import cliProgress from "cli-progress";
import extractZip from "extract-zip";
import ignore from "ignore";
import * as tar from "tar";
import {
	type ArchiveType,
	DownloadError,
	ExtractionError,
	type GitHubReleaseAsset,
} from "../types.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/safe-spinner.js";

export class DownloadManager {
	/**
	 * Maximum extraction size (500MB) to prevent archive bombs
	 */
	private static MAX_EXTRACTION_SIZE = 500 * 1024 * 1024; // 500MB

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
	 * Track total extracted size to prevent archive bombs
	 */
	private totalExtractedSize = 0;

	/**
	 * Instance-level ignore object with combined default and user patterns
	 */
	private ig: ReturnType<typeof ignore>;

	/**
	 * Store user-defined exclude patterns
	 */
	private userExcludePatterns: string[] = [];

	/**
	 * Initialize DownloadManager with default exclude patterns
	 */
	constructor() {
		// Initialize ignore with default patterns
		this.ig = ignore().add(DownloadManager.EXCLUDE_PATTERNS);
	}

	/**
	 * Set additional user-defined exclude patterns
	 * These are added to (not replace) the default EXCLUDE_PATTERNS
	 */
	setExcludePatterns(patterns: string[]): void {
		this.userExcludePatterns = patterns;
		// Reinitialize ignore with both default and user patterns
		this.ig = ignore().add([...DownloadManager.EXCLUDE_PATTERNS, ...this.userExcludePatterns]);

		if (patterns.length > 0) {
			logger.info(`Added ${patterns.length} custom exclude pattern(s)`);
			patterns.forEach((p) => logger.debug(`  - ${p}`));
		}
	}

	/**
	 * Check if file path should be excluded
	 * Uses instance-level ignore with both default and user patterns
	 */
	private shouldExclude(filePath: string): boolean {
		return this.ig.ignores(filePath);
	}

	/**
	 * Validate path to prevent path traversal attacks (zip slip)
	 */
	private isPathSafe(basePath: string, targetPath: string): boolean {
		// Resolve both paths to their absolute canonical forms
		const resolvedBase = resolve(basePath);
		const resolvedTarget = resolve(targetPath);

		// Calculate relative path from base to target
		const relativePath = relative(resolvedBase, resolvedTarget);

		// If path starts with .. or is absolute, it's trying to escape
		// Also block if relative path is empty but resolved paths differ (edge case)
		return (
			!relativePath.startsWith("..") &&
			!relativePath.startsWith("/") &&
			resolvedTarget.startsWith(resolvedBase)
		);
	}

	/**
	 * Track extracted file size and check against limit
	 */
	private checkExtractionSize(fileSize: number): void {
		this.totalExtractedSize += fileSize;
		if (this.totalExtractedSize > DownloadManager.MAX_EXTRACTION_SIZE) {
			throw new ExtractionError(
				`Archive exceeds maximum extraction size of ${this.formatBytes(DownloadManager.MAX_EXTRACTION_SIZE)}. Possible archive bomb detected.`,
			);
		}
	}

	/**
	 * Reset extraction size tracker
	 */
	private resetExtractionSize(): void {
		this.totalExtractedSize = 0;
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

			// Create progress bar with simple ASCII characters
			const progressBar = new cliProgress.SingleBar({
				format: "Progress |{bar}| {percentage}% | {value}/{total} MB",
				barCompleteChar: "=",
				barIncompleteChar: "-",
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

		// Create progress bar only if we know the size (using simple ASCII characters)
		const progressBar =
			totalSize > 0
				? new cliProgress.SingleBar({
						format: "Progress |{bar}| {percentage}% | {value}/{total} MB",
						barCompleteChar: "=",
						barIncompleteChar: "-",
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
		const spinner = createSpinner("Extracting files...").start();

		try {
			// Reset extraction size tracker
			this.resetExtractionSize();

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
		const { readdir, stat, mkdir: mkdirPromise, copyFile, rm } = await import("node:fs/promises");
		const { join: pathJoin } = await import("node:path");

		// Extract to a temporary directory first
		const tempExtractDir = `${destDir}-temp`;
		await mkdirPromise(tempExtractDir, { recursive: true });

		try {
			// Extract without stripping first
			await tar.extract({
				file: archivePath,
				cwd: tempExtractDir,
				strip: 0, // Don't strip yet - we'll decide based on wrapper detection
				filter: (path: string) => {
					// Exclude unwanted files
					const shouldInclude = !this.shouldExclude(path);
					if (!shouldInclude) {
						logger.debug(`Excluding: ${path}`);
					}
					return shouldInclude;
				},
			});

			logger.debug(`Extracted TAR.GZ to temp: ${tempExtractDir}`);

			// Apply same wrapper detection logic as zip
			const entries = await readdir(tempExtractDir);
			logger.debug(`Root entries: ${entries.join(", ")}`);

			if (entries.length === 1) {
				const rootEntry = entries[0];
				const rootPath = pathJoin(tempExtractDir, rootEntry);
				const rootStat = await stat(rootPath);

				if (rootStat.isDirectory()) {
					// Check contents of root directory
					const rootContents = await readdir(rootPath);
					logger.debug(`Root directory '${rootEntry}' contains: ${rootContents.join(", ")}`);

					// Only strip if root is a version/release wrapper
					const isWrapper = this.isWrapperDirectory(rootEntry);
					logger.debug(`Is wrapper directory: ${isWrapper}`);

					if (isWrapper) {
						// Strip wrapper and move contents
						logger.debug(`Stripping wrapper directory: ${rootEntry}`);
						await this.moveDirectoryContents(rootPath, destDir);
					} else {
						// Keep root directory - move everything including root
						logger.debug("Preserving complete directory structure");
						await this.moveDirectoryContents(tempExtractDir, destDir);
					}
				} else {
					// Single file, just move it
					await mkdirPromise(destDir, { recursive: true });
					await copyFile(rootPath, pathJoin(destDir, rootEntry));
				}
			} else {
				// Multiple entries at root, move them all
				logger.debug("Multiple root entries - moving all");
				await this.moveDirectoryContents(tempExtractDir, destDir);
			}

			logger.debug(`Moved contents to: ${destDir}`);

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
	 * Check if directory name is a version/release wrapper
	 * Examples: claudekit-engineer-v1.0.0, claudekit-engineer-1.0.0, repo-abc1234,
	 *           project-v1.0.0-alpha, project-1.2.3-beta.1, repo-v2.0.0-rc.5
	 */
	private isWrapperDirectory(dirName: string): boolean {
		// Match version patterns with optional prerelease: project-v1.0.0, project-1.0.0-alpha, project-v2.0.0-rc.1
		const versionPattern = /^[\w-]+-v?\d+\.\d+\.\d+(-[\w.]+)?$/;
		// Match commit hash patterns: project-abc1234 (7-40 chars for short/full SHA)
		const hashPattern = /^[\w-]+-[a-f0-9]{7,40}$/;

		return versionPattern.test(dirName) || hashPattern.test(dirName);
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
			// Extract zip to temp directory using extract-zip
			await extractZip(archivePath, { dir: tempExtractDir });

			logger.debug(`Extracted ZIP to temp: ${tempExtractDir}`);

			// Find the root directory in the zip (if any)
			const entries = await readdir(tempExtractDir);
			logger.debug(`Root entries: ${entries.join(", ")}`);

			// If there's a single root directory, check if it's a wrapper
			if (entries.length === 1) {
				const rootEntry = entries[0];
				const rootPath = pathJoin(tempExtractDir, rootEntry);
				const rootStat = await stat(rootPath);

				if (rootStat.isDirectory()) {
					// Check contents of root directory
					const rootContents = await readdir(rootPath);
					logger.debug(`Root directory '${rootEntry}' contains: ${rootContents.join(", ")}`);

					// Only strip if root is a version/release wrapper
					const isWrapper = this.isWrapperDirectory(rootEntry);
					logger.debug(`Is wrapper directory: ${isWrapper}`);

					if (isWrapper) {
						// Strip wrapper and move contents
						logger.debug(`Stripping wrapper directory: ${rootEntry}`);
						await this.moveDirectoryContents(rootPath, destDir);
					} else {
						// Keep root directory - move everything including root
						logger.debug("Preserving complete directory structure");
						await this.moveDirectoryContents(tempExtractDir, destDir);
					}
				} else {
					// Single file, just move it
					await mkdirPromise(destDir, { recursive: true });
					await copyFile(rootPath, pathJoin(destDir, rootEntry));
				}
			} else {
				// Multiple entries at root, move them all
				logger.debug("Multiple root entries - moving all");
				await this.moveDirectoryContents(tempExtractDir, destDir);
			}

			logger.debug(`Moved contents to: ${destDir}`);

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

			// Validate path safety (prevent path traversal)
			if (!this.isPathSafe(destDir, destPath)) {
				logger.warning(`Skipping unsafe path: ${relativePath}`);
				throw new ExtractionError(`Path traversal attempt detected: ${relativePath}`);
			}

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
				// Track file size and check limit
				this.checkExtractionSize(entryStat.size);
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

			// Validate path safety (prevent path traversal)
			if (!this.isPathSafe(destDir, destPath)) {
				logger.warning(`Skipping unsafe path: ${relativePath}`);
				throw new ExtractionError(`Path traversal attempt detected: ${relativePath}`);
			}

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
				// Track file size and check limit
				this.checkExtractionSize(entryStat.size);
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
	 * Validate extraction results
	 * @throws {ExtractionError} If validation fails
	 */
	async validateExtraction(extractDir: string): Promise<void> {
		const { readdir, access } = await import("node:fs/promises");
		const { join: pathJoin } = await import("node:path");
		const { constants } = await import("node:fs");

		try {
			// Check if extract directory exists and is not empty
			const entries = await readdir(extractDir);
			logger.debug(`Extracted files: ${entries.join(", ")}`);

			if (entries.length === 0) {
				throw new ExtractionError("Extraction resulted in no files");
			}

			// Verify critical paths exist
			const criticalPaths = [".claude", "CLAUDE.md"];
			const missingPaths: string[] = [];

			for (const path of criticalPaths) {
				try {
					await access(pathJoin(extractDir, path), constants.F_OK);
					logger.debug(`✓ Found: ${path}`);
				} catch {
					logger.warning(`Expected path not found: ${path}`);
					missingPaths.push(path);
				}
			}

			// Warn if critical paths are missing but don't fail validation
			if (missingPaths.length > 0) {
				logger.warning(
					`Some expected paths are missing: ${missingPaths.join(", ")}. This may not be a ClaudeKit project.`,
				);
			}

			logger.debug("Extraction validation passed");
		} catch (error) {
			if (error instanceof ExtractionError) {
				throw error;
			}
			throw new ExtractionError(
				`Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
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
