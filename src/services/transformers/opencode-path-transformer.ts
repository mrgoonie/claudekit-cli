/**
 * OpenCode Path Transformer
 *
 * Transforms hardcoded `.opencode/` paths in file contents to use platform-appropriate
 * global config paths when installing globally.
 *
 * Cross-platform compatibility:
 * - Unix/Linux/Mac: $HOME/.config/opencode/
 * - Windows: %APPDATA%/opencode/ (forward slashes work on Windows)
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { extname, join } from "node:path";
import { logger } from "@/shared/logger.js";

/** Cached platform detection */
export const IS_WINDOWS = platform() === "win32";

/** Platform-appropriate home prefix for OpenCode */
export const OPENCODE_HOME_PREFIX = IS_WINDOWS ? "%APPDATA%" : "$HOME/.config";

/** Get platform-appropriate OpenCode global path */
export function getOpenCodeGlobalPath(): string {
	return IS_WINDOWS ? "%APPDATA%/opencode/" : "$HOME/.config/opencode/";
}

// File extensions to transform (same as global-path-transformer)
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

/**
 * Transform .opencode/ path references in file content
 *
 * Handles patterns like:
 * - `.opencode/` -> `$HOME/.config/opencode/` (Unix)
 * - `./.opencode/` -> `$HOME/.config/opencode/`
 * - `".opencode/` -> `"$HOME/.config/opencode/`
 */
export function transformOpenCodeContent(content: string): {
	transformed: string;
	changes: number;
} {
	let changes = 0;
	let transformed = content;
	const globalPath = getOpenCodeGlobalPath();

	// Pattern 1: ./.opencode/ -> global path
	transformed = transformed.replace(/\.\/\.opencode\//g, () => {
		changes++;
		return globalPath;
	});

	// Pattern 2: Quoted paths ".opencode/ or '.opencode/ or `.opencode/
	transformed = transformed.replace(/(["'`])\.opencode\//g, (_match, quote) => {
		changes++;
		return `${quote}${globalPath}`;
	});

	// Pattern 3: Parentheses (.opencode/ for markdown links
	transformed = transformed.replace(/\(\.opencode\//g, () => {
		changes++;
		return `(${globalPath}`;
	});

	// Pattern 4: Space prefix " .opencode/"
	transformed = transformed.replace(/ \.opencode\//g, () => {
		changes++;
		return ` ${globalPath}`;
	});

	// Pattern 5: Start of line ^.opencode/
	transformed = transformed.replace(/^\.opencode\//gm, () => {
		changes++;
		return globalPath;
	});

	// Pattern 6: After colon (YAML/JSON) : .opencode/ or :.opencode/
	transformed = transformed.replace(/: \.opencode\//g, () => {
		changes++;
		return `: ${globalPath}`;
	});
	transformed = transformed.replace(/:\.opencode\//g, () => {
		changes++;
		return `:${globalPath}`;
	});

	return { transformed, changes };
}

/** Check if file should be transformed */
function shouldTransformFile(filename: string): boolean {
	const ext = extname(filename).toLowerCase();
	return TRANSFORMABLE_EXTENSIONS.has(ext);
}

/**
 * Recursively transform all files in a directory
 */
export async function transformPathsForGlobalOpenCode(
	directory: string,
	options: { verbose?: boolean } = {},
): Promise<{
	filesTransformed: number;
	totalChanges: number;
	filesSkipped: number;
}> {
	let filesTransformed = 0;
	let totalChanges = 0;
	let filesSkipped = 0;

	async function processDirectory(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules and hidden directories
				if (entry.name === "node_modules" || entry.name.startsWith(".")) {
					continue;
				}
				await processDirectory(fullPath);
			} else if (entry.isFile() && shouldTransformFile(entry.name)) {
				try {
					const content = await readFile(fullPath, "utf-8");
					const { transformed, changes } = transformOpenCodeContent(content);

					if (changes > 0) {
						await writeFile(fullPath, transformed, "utf-8");
						filesTransformed++;
						totalChanges += changes;

						if (options.verbose) {
							logger.verbose(`Transformed ${changes} OpenCode path(s) in ${fullPath}`);
						}
					}
				} catch (error) {
					filesSkipped++;
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

	return { filesTransformed, totalChanges, filesSkipped };
}
