import { join, relative, resolve } from "node:path";
import { lstat, pathExists, readdir } from "fs-extra";
import { logger } from "./logger.js";

/**
 * Utility class for scanning directories and comparing file structures
 */
export class FileScanner {
	/**
	 * Get all files in a directory recursively
	 *
	 * @param dirPath - Directory path to scan
	 * @param relativeTo - Base path for calculating relative paths (defaults to dirPath)
	 * @returns Array of relative file paths
	 *
	 * @example
	 * ```typescript
	 * const files = await FileScanner.getFiles('/path/to/dir');
	 * // Returns: ['file1.txt', 'subdir/file2.txt', ...]
	 * ```
	 */
	static async getFiles(dirPath: string, relativeTo?: string): Promise<string[]> {
		const basePath = relativeTo || dirPath;
		const files: string[] = [];

		// Check if directory exists
		if (!(await pathExists(dirPath))) {
			return files;
		}

		try {
			const entries = await readdir(dirPath, { encoding: "utf8" });

			for (const entry of entries) {
				const fullPath = join(dirPath, entry);

				// Security: Validate path to prevent traversal
				if (!FileScanner.isSafePath(basePath, fullPath)) {
					logger.warning(`Skipping potentially unsafe path: ${entry}`);
					continue;
				}

				const stats = await lstat(fullPath);

				// Skip symlinks for security
				if (stats.isSymbolicLink()) {
					logger.debug(`Skipping symlink: ${entry}`);
					continue;
				}

				if (stats.isDirectory()) {
					// Recursively scan subdirectories
					const subFiles = await FileScanner.getFiles(fullPath, basePath);
					files.push(...subFiles);
				} else if (stats.isFile()) {
					// Add relative path
					const relativePath = relative(basePath, fullPath);
					files.push(FileScanner.toPosixPath(relativePath));
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? `Failed to scan directory: ${dirPath} - ${error.message}`
					: `Failed to scan directory: ${dirPath}`;
			logger.error(errorMessage);
			throw error;
		}

		return files;
	}

	/**
	 * Find files in destination that don't exist in source
	 *
	 * @param destDir - Destination directory path
	 * @param sourceDir - Source directory path
	 * @param subPath - Subdirectory to compare (e.g., '.claude')
	 * @returns Array of relative file paths that are custom (exist in dest but not in source)
	 *
	 * @example
	 * ```typescript
	 * const customFiles = await FileScanner.findCustomFiles(
	 *   '/path/to/project',
	 *   '/path/to/release',
	 *   '.claude'
	 * );
	 * // Returns: ['.claude/custom-command.md', '.claude/workflows/my-workflow.md']
	 * ```
	 */
	static async findCustomFiles(
		destDir: string,
		sourceDir: string,
		subPath: string,
	): Promise<string[]> {
		const destSubDir = join(destDir, subPath);
		const sourceSubDir = join(sourceDir, subPath);

		// Get files from both directories
		const destFiles = await FileScanner.getFiles(destSubDir, destDir);
		const sourceFiles = await FileScanner.getFiles(sourceSubDir, sourceDir);

		// Create a Set of source files for O(1) lookup
		const sourceFileSet = new Set(sourceFiles);

		// Find files in destination that don't exist in source
		const customFiles = destFiles.filter((file) => !sourceFileSet.has(file));

		if (customFiles.length > 0) {
			logger.info(`Found ${customFiles.length} custom file(s) in ${subPath}/`);
			customFiles.slice(0, 5).forEach((file) => logger.debug(`  - ${file}`));
			if (customFiles.length > 5) {
				logger.debug(`  ... and ${customFiles.length - 5} more`);
			}
		}

		return customFiles;
	}

	/**
	 * Validate path to prevent path traversal attacks
	 *
	 * @param basePath - Base directory path
	 * @param targetPath - Target path to validate
	 * @returns true if path is safe, false otherwise
	 */
	private static isSafePath(basePath: string, targetPath: string): boolean {
		const resolvedBase = resolve(basePath);
		const resolvedTarget = resolve(targetPath);

		// Ensure target is within base
		return resolvedTarget.startsWith(resolvedBase);
	}

	/**
	 * Convert Windows-style paths (\\) to POSIX-style (/) for consistency
	 */
	private static toPosixPath(path: string): string {
		return path.replace(/\\/g, "/");
	}
}
