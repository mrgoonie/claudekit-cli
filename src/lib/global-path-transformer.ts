/**
 * Global Path Transformer
 *
 * Transforms hardcoded `.claude/` paths in file contents to `~/.claude/`
 * when installing globally. This allows the claudekit-engineer template
 * to remain project-scope friendly while the CLI handles the transformation
 * at install time.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { logger } from "../utils/logger.js";

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
 * Handles these patterns:
 * - `./.claude/` → `~/.claude/` (relative path)
 * - `@.claude/` → `@~/.claude/` (@ reference)
 * - `".claude/` → `"~/.claude/` (quoted)
 * - ` .claude/` → ` ~/.claude/` (space prefix)
 * - etc.
 */
function transformContent(content: string): { transformed: string; changes: number } {
	let changes = 0;
	let transformed = content;

	// Pattern 1: ./.claude/ → ~/.claude/ (remove ./ prefix entirely)
	transformed = transformed.replace(/\.\/\.claude\//g, () => {
		changes++;
		return "~/.claude/";
	});

	// Pattern 1b: @./.claude/ → @~/.claude/ (@ with relative path)
	transformed = transformed.replace(/@\.\/\.claude\//g, () => {
		changes++;
		return "@~/.claude/";
	});

	// Pattern 2: @.claude/ → @~/.claude/ (keep @ prefix)
	transformed = transformed.replace(/@\.claude\//g, () => {
		changes++;
		return "@~/.claude/";
	});

	// Pattern 3: Quoted paths ".claude/ or '.claude/ or `.claude/
	transformed = transformed.replace(/(["'`])\.claude\//g, (_match, quote) => {
		changes++;
		return `${quote}~/.claude/`;
	});

	// Pattern 4: Parentheses (.claude/ for markdown links
	transformed = transformed.replace(/\(\.claude\//g, () => {
		changes++;
		return "(~/.claude/";
	});

	// Pattern 5: Space prefix " .claude/" (but not already handled)
	transformed = transformed.replace(/ \.claude\//g, () => {
		changes++;
		return " ~/.claude/";
	});

	// Pattern 6: Start of line ^.claude/
	transformed = transformed.replace(/^\.claude\//gm, () => {
		changes++;
		return "~/.claude/";
	});

	// Pattern 7: After colon (YAML/JSON) : .claude/ or :.claude/
	transformed = transformed.replace(/: \.claude\//g, () => {
		changes++;
		return ": ~/.claude/";
	});
	transformed = transformed.replace(/:\.claude\//g, () => {
		changes++;
		return ":~/.claude/";
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
 */
export async function transformPathsForGlobalInstall(
	directory: string,
	options: { verbose?: boolean } = {},
): Promise<{ filesTransformed: number; totalChanges: number }> {
	let filesTransformed = 0;
	let totalChanges = 0;

	async function processDirectory(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules and hidden directories (except .claude itself)
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
					// Skip binary files or files that can't be read as text
					if (options.verbose) {
						logger.verbose(
							`Skipping ${fullPath}: ${error instanceof Error ? error.message : "unknown error"}`,
						);
					}
				}
			}
		}
	}

	await processDirectory(directory);

	return { filesTransformed, totalChanges };
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
