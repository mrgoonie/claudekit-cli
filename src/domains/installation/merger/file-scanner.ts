import { relative } from "node:path";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { lstat, readdir } from "fs-extra";
import ignore, { type Ignore } from "ignore";
import { minimatch } from "minimatch";

/**
 * FileScanner handles file discovery with pattern matching
 */
export class FileScanner {
	private includePatterns: string[] = [];
	private neverCopyChecker: Ignore;

	constructor(neverCopyPatterns: string[]) {
		this.neverCopyChecker = ignore().add(neverCopyPatterns);
	}

	/**
	 * Set include patterns (only files matching these patterns will be processed)
	 */
	setIncludePatterns(patterns: string[]): void {
		this.includePatterns = patterns;
	}

	/**
	 * Add custom patterns to never copy (security-sensitive files)
	 */
	addIgnorePatterns(patterns: string[]): void {
		this.neverCopyChecker.add(patterns);
	}

	/**
	 * Check if a file should be excluded based on security patterns
	 */
	shouldNeverCopy(normalizedPath: string): boolean {
		return this.neverCopyChecker.ignores(normalizedPath);
	}

	/**
	 * Recursively get all files in a directory, respecting include patterns
	 */
	async getFiles(dir: string, baseDir: string = dir): Promise<string[]> {
		const files: string[] = [];
		const entries = await readdir(dir, { encoding: "utf8" });

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const relativePath = relative(baseDir, fullPath);
			// Normalize to forward slashes for consistent pattern matching on all platforms
			const normalizedRelativePath = relativePath.replace(/\\/g, "/");

			// Security: Skip symbolic links to prevent directory traversal attacks
			// Use lstat() instead of stat() to detect symlinks before following them
			const stats = await lstat(fullPath);
			if (stats.isSymbolicLink()) {
				logger.warning(`Skipping symbolic link: ${normalizedRelativePath}`);
				continue;
			}

			// Apply include pattern filtering
			if (this.includePatterns.length > 0) {
				const shouldInclude = this.includePatterns.some((pattern) => {
					// Normalize pattern to support both directory and glob patterns
					const globPattern = pattern.includes("*") ? pattern : `${pattern}/**`;

					// For files: check if they match the glob pattern
					if (!stats.isDirectory()) {
						return minimatch(normalizedRelativePath, globPattern, { dot: true });
					}

					// For directories: allow traversal if this directory could lead to matching files
					const normalizedPattern = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
					const normalizedPath = normalizedRelativePath.endsWith("/")
						? normalizedRelativePath.slice(0, -1)
						: normalizedRelativePath;

					// Allow if pattern starts with this directory path OR directory matches pattern exactly
					return (
						normalizedPattern.startsWith(`${normalizedPath}/`) ||
						normalizedPattern === normalizedPath ||
						minimatch(normalizedRelativePath, globPattern, { dot: true })
					);
				});

				if (!shouldInclude) {
					continue;
				}
			}

			if (stats.isDirectory()) {
				const subFiles = await this.getFiles(fullPath, baseDir);
				files.push(...subFiles);
			} else {
				files.push(fullPath);
			}
		}

		return files;
	}
}
