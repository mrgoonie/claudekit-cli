import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { isMacOS } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import { createProgressBar } from "@/shared/progress-bar.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { type ArchiveType, DownloadError, ExtractionError, type GitHubReleaseAsset } from "@/types";
import extractZip from "extract-zip";
import ignore from "ignore";
import * as tar from "tar";

export class DownloadManager {
	/**
	 * Maximum extraction size (500MB) to prevent archive bombs
	 */
	private static MAX_EXTRACTION_SIZE = 500 * 1024 * 1024; // 500MB

	/**
	 * Threshold (ms) before showing slow extraction warning
	 * Helps users on macOS understand potential Spotlight indexing issues
	 */
	private static SLOW_EXTRACTION_THRESHOLD_MS = 30_000; // 30 seconds

	private static UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });

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
	 * Counter for sub-millisecond uniqueness in temp directory names
	 * Prevents race conditions when createTempDir is called rapidly
	 */
	private static tempDirCounter = 0;

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

	private normalizeZipEntryName(entryName: Buffer | string): string {
		if (entryName instanceof Uint8Array) {
			const decoded = DownloadManager.UTF8_DECODER.decode(entryName);
			return decoded;
		}

		if (typeof entryName === "string") {
			if (/[ÃÂâ]/u.test(entryName)) {
				try {
					const repaired = Buffer.from(entryName, "latin1").toString("utf8");
					if (!repaired.includes("�")) {
						logger.debug(`Recovered zip entry name: ${entryName} -> ${repaired}`);
						return repaired;
					}
				} catch (error) {
					logger.debug(
						`Failed to repair zip entry name ${entryName}: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
				}
			}
			return entryName;
		}

		return String(entryName);
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
	 * Decode percent-encoded file paths to handle Mojibake issues
	 *
	 * GitHub tarballs may contain percent-encoded paths (e.g., %20 for space, %C3%A9 for é)
	 * that need to be decoded to prevent character encoding corruption.
	 *
	 * @param path - File path that may contain URL-encoded characters
	 * @returns Decoded path, or original path if decoding fails
	 * @private
	 */
	private decodeFilePath(path: string): string {
		// Early exit for non-encoded paths (performance optimization)
		if (!path.includes("%")) {
			return path;
		}

		try {
			// Only decode if path contains valid percent-encoding pattern (%XX)
			if (/%[0-9A-F]{2}/i.test(path)) {
				const decoded = decodeURIComponent(path);
				logger.debug(`Decoded path: ${path} -> ${decoded}`);
				return decoded;
			}
			return path;
		} catch (error) {
			// If decoding fails (malformed encoding), return original path
			logger.warning(
				`Failed to decode path "${path}": ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return path;
		}
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

			output.info(`Downloading ${asset.name} (${this.formatBytes(asset.size)})...`);
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

		output.info(`Downloading ${name}${size ? ` (${this.formatBytes(size)})` : ""}...`);

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

	/**
	 * Extract archive to destination
	 */
	async extractArchive(
		archivePath: string,
		destDir: string,
		archiveType?: ArchiveType,
	): Promise<void> {
		const spinner = createSpinner("Extracting files...").start();

		// Set up a warning timer for slow extractions
		const slowExtractionWarning = setTimeout(() => {
			spinner.text = "Extracting files... (this may take a while on macOS)";
			if (isMacOS()) {
				logger.debug("Slow extraction detected on macOS - Spotlight indexing may be interfering");
			}
		}, DownloadManager.SLOW_EXTRACTION_THRESHOLD_MS);

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

			clearTimeout(slowExtractionWarning);
			spinner.succeed("Files extracted successfully");
		} catch (error) {
			clearTimeout(slowExtractionWarning);
			spinner.fail("Extraction failed");

			// Provide helpful message for macOS users
			if (isMacOS()) {
				logger.debug(
					"macOS extraction tip: Try disabling Spotlight for the target directory with: sudo mdutil -i off <path>",
				);
			}

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
					// Decode percent-encoded paths from GitHub tarballs
					const decodedPath = this.decodeFilePath(path);
					// Exclude unwanted files
					const shouldInclude = !this.shouldExclude(decodedPath);
					if (!shouldInclude) {
						logger.debug(`Excluding: ${decodedPath}`);
					}
					return shouldInclude;
				},
			});

			logger.debug(`Extracted TAR.GZ to temp: ${tempExtractDir}`);

			// Apply same wrapper detection logic as zip
			const entries = await readdir(tempExtractDir, { encoding: "utf8" });
			logger.debug(`Root entries: ${entries.join(", ")}`);

			if (entries.length === 1) {
				const rootEntry = entries[0];
				const rootPath = pathJoin(tempExtractDir, rootEntry);
				const rootStat = await stat(rootPath);

				if (rootStat.isDirectory()) {
					// Check contents of root directory
					const rootContents = await readdir(rootPath, { encoding: "utf8" });
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
	 * Try to extract zip using native unzip command (faster on macOS)
	 * Uses execFile with array arguments to prevent command injection
	 * Returns true if successful, false if native unzip unavailable or failed
	 */
	private async tryNativeUnzip(archivePath: string, destDir: string): Promise<boolean> {
		// Only try native unzip on macOS where extract-zip has known performance issues
		if (!isMacOS()) {
			return false;
		}

		return new Promise((resolve) => {
			const { mkdir: mkdirPromise } = require("node:fs/promises");

			// Ensure destination exists
			mkdirPromise(destDir, { recursive: true })
				.then(() => {
					// Use execFile with array arguments to prevent command injection
					// -o: overwrite without prompting, -q: quiet mode
					execFile("unzip", ["-o", "-q", archivePath, "-d", destDir], (error, _stdout, stderr) => {
						if (error) {
							logger.debug(`Native unzip failed: ${stderr || error.message}`);
							resolve(false);
							return;
						}
						logger.debug("Native unzip succeeded");
						resolve(true);
					});
				})
				.catch((err: Error) => {
					logger.debug(`Failed to create directory for native unzip: ${err.message}`);
					resolve(false);
				});
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
			// Try native unzip on macOS first (faster, avoids known issues)
			const nativeSuccess = await this.tryNativeUnzip(archivePath, tempExtractDir);

			if (!nativeSuccess) {
				// Fall back to extract-zip
				logger.debug("Using extract-zip library");

				// Note: extract-zip's TypeScript types don't expose the yauzl option,
				// but it's needed to handle non-UTF8 encoded filenames. We use a type
				// assertion here because this is an intentional use of an undocumented
				// but stable internal option. See: https://github.com/maxogden/extract-zip
				interface ExtractZipOptions {
					dir: string;
					onEntry?: (entry: { fileName: Buffer | string }) => void;
					yauzl?: { decodeStrings: boolean };
				}

				let extractedCount = 0;
				const zipOptions: ExtractZipOptions = {
					dir: tempExtractDir,
					onEntry: (entry) => {
						const normalized = this.normalizeZipEntryName(entry.fileName);
						(entry as { fileName: string }).fileName = normalized;
						extractedCount++;
					},
					yauzl: { decodeStrings: false },
				};

				// DEP0005 warning is suppressed globally in index.ts
				await extractZip(archivePath, zipOptions as Parameters<typeof extractZip>[1]);
				logger.verbose(`Extracted ${extractedCount} files`);
			}

			logger.debug(`Extracted ZIP to temp: ${tempExtractDir}`);

			// Find the root directory in the zip (if any)
			const entries = await readdir(tempExtractDir, { encoding: "utf8" });
			logger.debug(`Root entries: ${entries.join(", ")}`);

			// If there's a single root directory, check if it's a wrapper
			if (entries.length === 1) {
				const rootEntry = entries[0];
				const rootPath = pathJoin(tempExtractDir, rootEntry);
				const rootStat = await stat(rootPath);

				if (rootStat.isDirectory()) {
					// Check contents of root directory
					const rootContents = await readdir(rootPath, { encoding: "utf8" });
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

		const entries = await readdir(sourceDir, { encoding: "utf8" });

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

		const entries = await readdir(sourceDir, { encoding: "utf8" });

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
			const entries = await readdir(extractDir, { encoding: "utf8" });
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
	 * Create temporary download directory with fallback
	 * Primary: OS temp directory (e.g., /tmp, /var/folders on macOS)
	 * Fallback: ~/.claudekit/tmp (for sandboxed/restricted environments)
	 */
	async createTempDir(): Promise<string> {
		const timestamp = Date.now();
		const counter = DownloadManager.tempDirCounter++;

		// Try primary: OS temp directory
		const primaryTempDir = join(tmpdir(), `claudekit-${timestamp}-${counter}`);
		try {
			await mkdir(primaryTempDir, { recursive: true });
			logger.debug(`Created temp directory: ${primaryTempDir}`);
			return primaryTempDir;
		} catch (primaryError) {
			logger.debug(
				`Failed to create temp directory in OS temp: ${primaryError instanceof Error ? primaryError.message : "Unknown error"}`,
			);

			// Fallback: User home directory
			const homeDir = process.env.HOME || process.env.USERPROFILE;
			if (!homeDir) {
				throw new DownloadError(
					`Cannot create temporary directory. Permission denied for ${primaryTempDir} and HOME directory not found.\n\nSolutions:\n  1. Run with elevated permissions\n  2. Set HOME environment variable\n  3. Try running from a different directory`,
				);
			}

			const fallbackTempDir = join(
				homeDir,
				".claudekit",
				"tmp",
				`claudekit-${timestamp}-${counter}`,
			);
			try {
				await mkdir(fallbackTempDir, { recursive: true });
				logger.debug(`Created temp directory (fallback): ${fallbackTempDir}`);
				logger.warning(
					`Using fallback temp directory: ${fallbackTempDir}\n  (OS temp directory was not accessible)`,
				);
				return fallbackTempDir;
			} catch (fallbackError) {
				const errorMsg =
					fallbackError instanceof Error ? fallbackError.message : "Permission denied";
				throw new DownloadError(
					`Cannot create temporary directory.\n\nPrimary location failed: ${primaryTempDir}\nFallback location failed: ${fallbackTempDir}\n\nError: ${errorMsg}\n\nSolutions:\n  1. Check disk space and permissions\n  2. Run with elevated permissions\n  3. Try running from a different directory`,
				);
			}
		}
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
