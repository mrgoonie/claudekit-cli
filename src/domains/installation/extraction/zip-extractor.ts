/**
 * ZIP archive extraction with native unzip fallback
 */
import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { isMacOS } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import extractZip from "extract-zip";
import { isWrapperDirectory } from "../utils/archive-utils.js";
import { normalizeZipEntryName } from "../utils/encoding-utils.js";
import type { ExclusionFilter } from "../utils/file-utils.js";
import { moveDirectoryContents } from "../utils/file-utils.js";
import type { ExtractionSizeTracker } from "../utils/path-security.js";

/**
 * Extended extract-zip options type for yauzl support
 */
interface ExtractZipOptions {
	dir: string;
	onEntry?: (entry: { fileName: Buffer | string }) => void;
	yauzl?: { decodeStrings: boolean };
}

/**
 * ZIP archive extractor with native unzip fallback on macOS
 */
export class ZipExtractor {
	/**
	 * Try to extract zip using native unzip command (faster on macOS)
	 * Uses execFile with array arguments to prevent command injection
	 * @param archivePath - Path to ZIP archive
	 * @param destDir - Destination directory
	 * @returns true if successful, false if native unzip unavailable or failed
	 */
	private async tryNativeUnzip(archivePath: string, destDir: string): Promise<boolean> {
		// Only try native unzip on macOS where extract-zip has known performance issues
		if (!isMacOS()) {
			return false;
		}

		return new Promise((resolve) => {
			// Ensure destination exists
			mkdir(destDir, { recursive: true })
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
	 * Extract ZIP archive
	 * @param archivePath - Path to ZIP archive
	 * @param destDir - Destination directory
	 * @param shouldExclude - Exclusion filter function
	 * @param sizeTracker - Extraction size tracker for archive bomb protection
	 */
	async extract(
		archivePath: string,
		destDir: string,
		shouldExclude: ExclusionFilter,
		sizeTracker: ExtractionSizeTracker,
	): Promise<void> {
		// Extract to a temporary directory first
		const tempExtractDir = `${destDir}-temp`;
		await mkdir(tempExtractDir, { recursive: true });

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
				let extractedCount = 0;
				const zipOptions: ExtractZipOptions = {
					dir: tempExtractDir,
					onEntry: (entry) => {
						const normalized = normalizeZipEntryName(entry.fileName);
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
				const rootPath = join(tempExtractDir, rootEntry);
				const rootStat = await stat(rootPath);

				if (rootStat.isDirectory()) {
					// Check contents of root directory
					const rootContents = await readdir(rootPath, { encoding: "utf8" });
					logger.debug(`Root directory '${rootEntry}' contains: ${rootContents.join(", ")}`);

					// Only strip if root is a version/release wrapper
					const isWrapper = isWrapperDirectory(rootEntry);
					logger.debug(`Is wrapper directory: ${isWrapper}`);

					if (isWrapper) {
						// Strip wrapper and move contents
						logger.debug(`Stripping wrapper directory: ${rootEntry}`);
						await moveDirectoryContents(rootPath, destDir, shouldExclude, sizeTracker);
					} else {
						// Keep root directory - move everything including root
						logger.debug("Preserving complete directory structure");
						await moveDirectoryContents(tempExtractDir, destDir, shouldExclude, sizeTracker);
					}
				} else {
					// Single file, just move it
					await mkdir(destDir, { recursive: true });
					await copyFile(rootPath, join(destDir, rootEntry));
				}
			} else {
				// Multiple entries at root, move them all
				logger.debug("Multiple root entries - moving all");
				await moveDirectoryContents(tempExtractDir, destDir, shouldExclude, sizeTracker);
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
}
