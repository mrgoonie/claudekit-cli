/**
 * Folder Path Transformer
 *
 * Transforms default folder names (docs/, plans/) to custom names during
 * ClaudeKit installation. Handles both directory renaming and path reference
 * updates in markdown and config files.
 */

import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { logger } from "@/shared/logger.js";
import { DEFAULT_FOLDERS, type FoldersConfig } from "@/types";
import { pathExists } from "fs-extra";

export interface FolderTransformResult {
	foldersRenamed: number;
	filesTransformed: number;
	totalReferences: number;
}

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
 * Transform folder names and references in extracted files
 */
export async function transformFolderPaths(
	extractDir: string,
	folders: Required<FoldersConfig>,
	options: FolderTransformOptions = {},
): Promise<FolderTransformResult> {
	const result: FolderTransformResult = {
		foldersRenamed: 0,
		filesTransformed: 0,
		totalReferences: 0,
	};

	// Check if any transformation is needed
	const needsTransform =
		folders.docs !== DEFAULT_FOLDERS.docs || folders.plans !== DEFAULT_FOLDERS.plans;

	if (!needsTransform) {
		logger.debug("No folder transformation needed (using defaults)");
		return result;
	}

	logger.info("Transforming folder paths...");

	// Build replacement map
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

	// Step 1: Rename directories
	const dirsToRename: Array<{ from: string; to: string }> = [];

	if (folders.docs !== DEFAULT_FOLDERS.docs) {
		const docsPath = join(extractDir, DEFAULT_FOLDERS.docs);
		if (await pathExists(docsPath)) {
			dirsToRename.push({
				from: docsPath,
				to: join(extractDir, folders.docs),
			});
		}
		// Also check inside .claude directory
		const claudeDocsPath = join(extractDir, ".claude", DEFAULT_FOLDERS.docs);
		if (await pathExists(claudeDocsPath)) {
			dirsToRename.push({
				from: claudeDocsPath,
				to: join(extractDir, ".claude", folders.docs),
			});
		}
	}

	if (folders.plans !== DEFAULT_FOLDERS.plans) {
		const plansPath = join(extractDir, DEFAULT_FOLDERS.plans);
		if (await pathExists(plansPath)) {
			dirsToRename.push({
				from: plansPath,
				to: join(extractDir, folders.plans),
			});
		}
		// Also check inside .claude directory
		const claudePlansPath = join(extractDir, ".claude", DEFAULT_FOLDERS.plans);
		if (await pathExists(claudePlansPath)) {
			dirsToRename.push({
				from: claudePlansPath,
				to: join(extractDir, ".claude", folders.plans),
			});
		}
	}

	// Rename directories
	for (const { from, to } of dirsToRename) {
		if (options.dryRun) {
			logger.info(
				`[dry-run] Would rename: ${relative(extractDir, from)} → ${relative(extractDir, to)}`,
			);
		} else {
			try {
				await rename(from, to);
				logger.debug(`Renamed: ${relative(extractDir, from)} → ${relative(extractDir, to)}`);
				result.foldersRenamed++;
			} catch (error) {
				logger.warning(
					`Failed to rename ${from}: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}
	}

	// Step 2: Transform file contents
	// Pre-compile regex patterns once for efficiency (avoid recreating per-file)
	const compiledReplacements: Array<{ regex: RegExp; replacement: string }> = [];
	for (const [search, replace] of replacements) {
		compiledReplacements.push({
			regex: new RegExp(escapeRegExp(search), "g"),
			replacement: replace,
		});
	}

	const transformedFiles = await transformFileContents(extractDir, compiledReplacements, options);
	result.filesTransformed = transformedFiles.filesChanged;
	result.totalReferences = transformedFiles.replacementsCount;

	if (options.verbose) {
		logger.info(
			`Folder transformation complete: ${result.foldersRenamed} folders renamed, ` +
				`${result.filesTransformed} files updated, ${result.totalReferences} references changed`,
		);
	}

	return result;
}

/**
 * Transform file contents recursively using pre-compiled regex patterns
 */
async function transformFileContents(
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

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate CLI folder options and exit on error
 * Use this in CLI commands to validate --docs-dir and --plans-dir flags
 */
export function validateFolderOptions(options: {
	docsDir?: string;
	plansDir?: string;
}): void {
	if (options.docsDir) {
		const docsError = validateFolderName(options.docsDir);
		if (docsError) {
			logger.error(`Invalid --docs-dir value: ${docsError}`);
			process.exit(1);
		}
	}
	if (options.plansDir) {
		const plansError = validateFolderName(options.plansDir);
		if (plansError) {
			logger.error(`Invalid --plans-dir value: ${plansError}`);
			process.exit(1);
		}
	}
}

/**
 * Validate custom folder name
 * Returns error message if invalid, null if valid
 */
export function validateFolderName(name: string): string | null {
	if (!name || name.trim().length === 0) {
		return "Folder name cannot be empty";
	}

	// Check for path traversal
	if (name.includes("..") || name.includes("/") || name.includes("\\")) {
		return "Folder name cannot contain path separators or parent references";
	}

	// Check for invalid characters (includes control chars 0x00-0x1f)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional check for invalid filename characters
	const invalidChars = /[<>:"|?*\x00-\x1f]/;
	if (invalidChars.test(name)) {
		return "Folder name contains invalid characters";
	}

	// Check for reserved names (Windows)
	const reservedNames = [
		"CON",
		"PRN",
		"AUX",
		"NUL",
		"COM1",
		"COM2",
		"COM3",
		"COM4",
		"COM5",
		"COM6",
		"COM7",
		"COM8",
		"COM9",
		"LPT1",
		"LPT2",
		"LPT3",
		"LPT4",
		"LPT5",
		"LPT6",
		"LPT7",
		"LPT8",
		"LPT9",
	];
	if (reservedNames.includes(name.toUpperCase())) {
		return "Folder name is a reserved system name";
	}

	// Check length
	if (name.length > 255) {
		return "Folder name is too long (max 255 characters)";
	}

	return null;
}
