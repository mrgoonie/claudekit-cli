/**
 * Path Replacer
 *
 * Handles content replacement logic for folder path transformation.
 * Recursively processes files and replaces folder path references.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { logger } from "@/shared/logger.js";
import { DEFAULT_FOLDERS, type FoldersConfig } from "@/types";

export interface FolderTransformOptions {
	verbose?: boolean;
	dryRun?: boolean;
}

/**
 * File patterns to search for folder references
 * Only process text files that may contain path references
 */
const TRANSFORMABLE_FILE_PATTERNS = [
	".md",
	".txt",
	".json",
	".yaml",
	".yml",
	".toml",
	".sh",
	".bash",
	".zsh",
	".ps1",
	".ts",
	".js",
	".mjs",
	".cjs",
];

/**
 * Escape special regex characters
 */
export function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build replacement map for folder path transformations
 */
export function buildReplacementMap(folders: Required<FoldersConfig>): Map<string, string> {
	const replacements: Map<string, string> = new Map();

	if (folders.docs !== DEFAULT_FOLDERS.docs) {
		// Replace both with and without trailing slash
		replacements.set(`${DEFAULT_FOLDERS.docs}/`, `${folders.docs}/`);
		replacements.set(`"${DEFAULT_FOLDERS.docs}"`, `"${folders.docs}"`);
		replacements.set(`'${DEFAULT_FOLDERS.docs}'`, `'${folders.docs}'`);
		replacements.set(`/${DEFAULT_FOLDERS.docs}`, `/${folders.docs}`);
		// Handle path references like ./docs or docs/
		replacements.set(`./${DEFAULT_FOLDERS.docs}`, `./${folders.docs}`);
	}

	if (folders.plans !== DEFAULT_FOLDERS.plans) {
		replacements.set(`${DEFAULT_FOLDERS.plans}/`, `${folders.plans}/`);
		replacements.set(`"${DEFAULT_FOLDERS.plans}"`, `"${folders.plans}"`);
		replacements.set(`'${DEFAULT_FOLDERS.plans}'`, `'${folders.plans}'`);
		replacements.set(`/${DEFAULT_FOLDERS.plans}`, `/${folders.plans}`);
		replacements.set(`./${DEFAULT_FOLDERS.plans}`, `./${folders.plans}`);
	}

	return replacements;
}

/**
 * Compile replacement patterns to regex for efficient processing
 */
export function compileReplacements(
	replacements: Map<string, string>,
): Array<{ regex: RegExp; replacement: string }> {
	const compiled: Array<{ regex: RegExp; replacement: string }> = [];
	for (const [search, replace] of replacements) {
		compiled.push({
			regex: new RegExp(escapeRegExp(search), "g"),
			replacement: replace,
		});
	}
	return compiled;
}

/**
 * Transform file contents recursively using pre-compiled regex patterns
 */
export async function transformFileContents(
	dir: string,
	compiledReplacements: Array<{ regex: RegExp; replacement: string }>,
	options: FolderTransformOptions,
): Promise<{ filesChanged: number; replacementsCount: number }> {
	let filesChanged = 0;
	let replacementsCount = 0;

	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			// Skip node_modules and .git
			if (entry.name === "node_modules" || entry.name === ".git") {
				continue;
			}
			const subResult = await transformFileContents(fullPath, compiledReplacements, options);
			filesChanged += subResult.filesChanged;
			replacementsCount += subResult.replacementsCount;
		} else if (entry.isFile()) {
			// Check if file should be transformed
			const shouldTransform = TRANSFORMABLE_FILE_PATTERNS.some((ext) =>
				entry.name.toLowerCase().endsWith(ext),
			);

			if (!shouldTransform) continue;

			try {
				const content = await readFile(fullPath, "utf-8");
				let newContent = content;
				let changeCount = 0;

				// Apply all pre-compiled replacements
				for (const { regex, replacement } of compiledReplacements) {
					// Reset regex lastIndex for global patterns
					regex.lastIndex = 0;
					const matches = newContent.match(regex);
					if (matches) {
						changeCount += matches.length;
						regex.lastIndex = 0;
						newContent = newContent.replace(regex, replacement);
					}
				}

				if (changeCount > 0) {
					if (options.dryRun) {
						logger.debug(
							`[dry-run] Would update ${relative(dir, fullPath)}: ${changeCount} replacement(s)`,
						);
					} else {
						await writeFile(fullPath, newContent, "utf-8");
						logger.debug(`Updated ${relative(dir, fullPath)}: ${changeCount} replacement(s)`);
					}
					filesChanged++;
					replacementsCount += changeCount;
				}
			} catch (error) {
				// Skip binary files or files that can't be read as text
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
					logger.debug(
						`Skipped ${entry.name}: ${error instanceof Error ? error.message : "Unknown"}`,
					);
				}
			}
		}
	}

	return { filesChanged, replacementsCount };
}
