/**
 * Global Path Transformer
 *
 * Transforms hardcoded `.claude/` paths in file contents to use platform-appropriate
 * home directory paths when installing globally. This allows the claudekit-engineer
 * template to remain project-scope friendly while the CLI handles the transformation
 * at install time.
 *
 * Cross-platform compatibility:
 * - Unix/Linux/Mac: Uses $HOME/.claude/
 * - Windows: Uses %USERPROFILE%\.claude\
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { extname, join } from "node:path";
import { logger } from "../utils/logger.js";

/**
 * Cached platform-appropriate home directory prefix
 * Computed once at module load time for performance
 *
 * @internal Exported for testing purposes only
 */
export const HOME_PREFIX = platform() === "win32" ? "%USERPROFILE%" : "$HOME";

/**
 * Get the platform-appropriate home directory variable for use in paths
 *
 * @returns Home directory prefix that works across platforms
 *   - Windows: %USERPROFILE%
 *   - Unix/Linux/Mac: $HOME
 *
 * @internal Exported for testing purposes
 */
export function getHomeDirPrefix(): string {
	return HOME_PREFIX;
}

// File extensions to transform
const TRANSFORMABLE_EXTENSIONS = new Set([
	".md",
	".js",
	".ts",
	".json",
	".sh",
	".ps1",
	".yaml",
	".yml",
	".toml",
]);

// Files to always transform regardless of extension
const ALWAYS_TRANSFORM_FILES = new Set(["CLAUDE.md", "claude.md"]);

/**
 * Transform path references in file content
 *
 * Handles these patterns (examples for Unix, Windows uses %USERPROFILE%):
 * - `./.claude/` → `$HOME/.claude/` (relative path)
 * - `@.claude/` → `@$HOME/.claude/` (@ reference)
 * - `".claude/` → `"$HOME/.claude/` (quoted)
 * - ` .claude/` → ` $HOME/.claude/` (space prefix)
 * - etc.
 *
 * Cross-platform: Uses $HOME on Unix/Linux/Mac, %USERPROFILE% on Windows
 *
 * @internal Exported for testing purposes
 */
export function transformContent(content: string): { transformed: string; changes: number } {
	let changes = 0;
	let transformed = content;
	const homePrefix = getHomeDirPrefix();

	// Pattern 1: ./.claude/ → $HOME/.claude/ (remove ./ prefix entirely)
	transformed = transformed.replace(/\.\/\.claude\//g, () => {
		changes++;
		return `${homePrefix}/.claude/`;
	});

	// Pattern 1b: @./.claude/ → @$HOME/.claude/ (@ with relative path)
	transformed = transformed.replace(/@\.\/\.claude\//g, () => {
		changes++;
		return `@${homePrefix}/.claude/`;
	});

	// Pattern 2: @.claude/ → @$HOME/.claude/ (keep @ prefix)
	transformed = transformed.replace(/@\.claude\//g, () => {
		changes++;
		return `@${homePrefix}/.claude/`;
	});

	// Pattern 3: Quoted paths ".claude/ or '.claude/ or `.claude/
	transformed = transformed.replace(/(["'`])\.claude\//g, (_match, quote) => {
		changes++;
		return `${quote}${homePrefix}/.claude/`;
	});

	// Pattern 4: Parentheses (.claude/ for markdown links
	transformed = transformed.replace(/\(\.claude\//g, () => {
		changes++;
		return `(${homePrefix}/.claude/`;
	});

	// Pattern 5: Space prefix " .claude/" (but not already handled)
	transformed = transformed.replace(/ \.claude\//g, () => {
		changes++;
		return ` ${homePrefix}/.claude/`;
	});

	// Pattern 6: Start of line ^.claude/
	transformed = transformed.replace(/^\.claude\//gm, () => {
		changes++;
		return `${homePrefix}/.claude/`;
	});

	// Pattern 7: After colon (YAML/JSON) : .claude/ or :.claude/
	transformed = transformed.replace(/: \.claude\//g, () => {
		changes++;
		return `: ${homePrefix}/.claude/`;
	});
	transformed = transformed.replace(/:\.claude\//g, () => {
		changes++;
		return `:${homePrefix}/.claude/`;
	});

	return { transformed, changes };
}

/**
 * Check if a file should be transformed based on extension or name
 */
function shouldTransformFile(filename: string): boolean {
	const ext = extname(filename).toLowerCase();
	const basename = filename.split("/").pop() || filename;

	return TRANSFORMABLE_EXTENSIONS.has(ext) || ALWAYS_TRANSFORM_FILES.has(basename);
}

/**
 * Recursively transform all files in a directory
 *
 * @param directory - Directory to process
 * @param options - Transformation options
 * @returns Statistics about the transformation including files processed, transformed, and skipped
 */
export async function transformPathsForGlobalInstall(
	directory: string,
	options: { verbose?: boolean } = {},
): Promise<{
	filesTransformed: number;
	totalChanges: number;
	filesSkipped: number;
	skippedFiles: Array<{ path: string; reason: string }>;
}> {
	let filesTransformed = 0;
	let totalChanges = 0;
	let filesSkipped = 0;
	const skippedFiles: Array<{ path: string; reason: string }> = [];

	async function processDirectory(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules and hidden directories (except .claude itself)
				// Design assumption: Archive source content should not contain nested
				// .claude directories (e.g., example projects with their own .claude).
				// If archives do contain nested .claude dirs, they will be skipped to
				// avoid unintended path transformations in template/example code.
				if (
					entry.name === "node_modules" ||
					(entry.name.startsWith(".") && entry.name !== ".claude")
				) {
					continue;
				}
				await processDirectory(fullPath);
			} else if (entry.isFile() && shouldTransformFile(entry.name)) {
				try {
					const content = await readFile(fullPath, "utf-8");
					const { transformed, changes } = transformContent(content);

					if (changes > 0) {
						await writeFile(fullPath, transformed, "utf-8");
						filesTransformed++;
						totalChanges += changes;

						if (options.verbose) {
							logger.verbose(`Transformed ${changes} path(s) in ${fullPath}`);
						}
					}
				} catch (error) {
					// Track skipped files for reporting
					const reason = error instanceof Error ? error.message : "unknown error";
					filesSkipped++;
					skippedFiles.push({ path: fullPath, reason });

					// Always log skipped files at debug level for troubleshooting
					logger.debug(`Skipping ${fullPath}: ${reason}`);

					if (options.verbose) {
						logger.verbose(`Skipping ${fullPath}: ${reason}`);
					}
				}
			}
		}
	}

	await processDirectory(directory);

	// Log summary if files were skipped
	if (filesSkipped > 0 && options.verbose) {
		logger.verbose(`Skipped ${filesSkipped} file(s) during path transformation`);
	}

	return { filesTransformed, totalChanges, filesSkipped, skippedFiles };
}

/**
 * Transform a single file's content (useful for testing)
 */
export async function transformFile(
	filePath: string,
): Promise<{ success: boolean; changes: number }> {
	try {
		const content = await readFile(filePath, "utf-8");
		const { transformed, changes } = transformContent(content);

		if (changes > 0) {
			await writeFile(filePath, transformed, "utf-8");
		}

		return { success: true, changes };
	} catch (error) {
		return { success: false, changes: 0 };
	}
}
