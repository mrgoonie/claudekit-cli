/**
 * TAR.GZ archive extraction
 */
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import * as tar from "tar";
import { isWrapperDirectory } from "../utils/archive-utils.js";
import { decodeFilePath } from "../utils/encoding-utils.js";
import type { ExclusionFilter } from "../utils/file-utils.js";
import { moveDirectoryContents } from "../utils/file-utils.js";
import type { ExtractionSizeTracker } from "../utils/path-security.js";

/**
 * TAR.GZ archive extractor
 */
export class TarExtractor {
	/**
	 * Extract tar.gz archive
	 * @param archivePath - Path to tar.gz archive
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
			// Extract without stripping first
			await tar.extract({
				file: archivePath,
				cwd: tempExtractDir,
				strip: 0, // Don't strip yet - we'll decide based on wrapper detection
				filter: (path: string) => {
					// Decode percent-encoded paths from GitHub tarballs
					const decodedPath = decodeFilePath(path);
					// Exclude unwanted files
					const shouldInclude = !shouldExclude(decodedPath);
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
