import { join, relative, resolve } from "node:path";
import { lstat, pathExists, readdir } from "fs-extra";
import { logger } from "./logger.js";

/**
 * Directories to skip during scanning to avoid:
 * - Permission issues (venvs, node_modules)
 * - Unnecessary scans (build artifacts, version control)
 */
const SKIP_DIRS = [
	// Build/package artifacts
	"node_modules",
	".venv",
	"venv",
	".test-venv",
	"__pycache__",
	".git",
	".svn",
	"dist",
	"build",
	// Claude Code internal directories (not ClaudeKit files)
	"debug",
	"projects",
	"shell-snapshots",
	"file-history",
	"todos",
	"session-env",
	"statsig",
	".anthropic",
];

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
				// Skip known problematic directories early
				if (SKIP_DIRS.includes(entry)) {
					logger.debug(`Skipping directory: ${entry}`);
					continue;
				}

				const fullPath = join(dirPath, entry);

				// Security: Validate path to prevent traversal
				if (!FileScanner.isSafePath(basePath, fullPath)) {
					logger.warning(`Skipping potentially unsafe path: ${entry}`);
					continue;
				}

				// Wrap lstat in try-catch to handle permission errors gracefully
				let stats;
				try {
					stats = await lstat(fullPath);
				} catch (error) {
					// Handle permission denied and other access errors
					if (
						error instanceof Error &&
						"code" in error &&
						(error.code === "EACCES" || error.code === "EPERM")
					) {
						logger.warning(`Skipping inaccessible path: ${entry}`);
						continue;
					}
					// Re-throw other errors (e.g., file not found during race condition)
					throw error;
				}

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
	 * @param subPath - Subdirectory to compare (e.g., '.claude', or '' for global mode)
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

		// Debug logging for path troubleshooting
		logger.debug(`findCustomFiles - destDir: ${destDir}`);
		logger.debug(`findCustomFiles - sourceDir: ${sourceDir}`);
		logger.debug(`findCustomFiles - subPath: "${subPath}"`);
		logger.debug(`findCustomFiles - destSubDir: ${destSubDir}`);
		logger.debug(`findCustomFiles - sourceSubDir: ${sourceSubDir}`);

		// Get files from both directories
		const destFiles = await FileScanner.getFiles(destSubDir, destDir);
		const sourceFiles = await FileScanner.getFiles(sourceSubDir, sourceDir);

		logger.debug(`findCustomFiles - destFiles count: ${destFiles.length}`);
		logger.debug(`findCustomFiles - sourceFiles count: ${sourceFiles.length}`);

		// Safeguard: If source directory exists but is empty, and dest has many files,
		// something is likely wrong with extraction. Skip custom file detection to prevent
		// incorrectly treating thousands of files as "custom".
		// Note: If source doesn't exist at all, all dest files are legitimately custom.
		const sourceExists = await pathExists(sourceSubDir);
		if (sourceExists && sourceFiles.length === 0 && destFiles.length > 100) {
			logger.warning(
				`Source directory exists but is empty while destination has ${destFiles.length} files. This may indicate an extraction issue. Skipping custom file detection.`,
			);
			return [];
		}

		// Create a Set of source files for O(1) lookup
		const sourceFileSet = new Set(sourceFiles);

		// Find files in destination that don't exist in source
		const customFiles = destFiles.filter((file) => !sourceFileSet.has(file));

		if (customFiles.length > 0) {
			// Fix: Show meaningful path instead of "/" when subPath is empty (global mode)
			const displayPath = subPath || destSubDir;
			logger.info(`Found ${customFiles.length} custom file(s) in ${displayPath}`);
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
