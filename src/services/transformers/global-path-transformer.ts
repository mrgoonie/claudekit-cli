/**
 * Global Path Transformer
 *
 * Transforms hardcoded `.claude/` paths in file contents to use platform-appropriate
 * home directory paths when installing globally. This allows the claudekit-engineer
 * template to remain project-scope friendly while the CLI handles the transformation
 * at install time.
 *
 * Cross-platform compatibility:
 * - All platforms use $HOME/.claude/ — Claude Code on Windows runs hook commands
 *   through a POSIX shell that expands $HOME but NOT %USERPROFILE% (verified
 *   empirically against Claude Code 2.1.101 on Windows). Emitting %USERPROFILE%
 *   produced silently broken hooks (issue #715).
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { extname, join } from "node:path";
import { logger } from "@/shared/logger.js";

/**
 * Cached platform detection
 * Computed once at module load time for performance
 *
 * @internal Exported for testing purposes only
 */
export const IS_WINDOWS = platform() === "win32";

/**
 * Home directory prefix — `$HOME` on all platforms.
 * Claude Code's Windows runtime uses a POSIX shell that expands $HOME but not
 * %USERPROFILE%. See issue #715.
 *
 * @internal Exported for testing purposes only
 */
export const HOME_PREFIX = "$HOME";

/**
 * Get the home directory variable for use in paths.
 * Returns `$HOME` on every platform — see HOME_PREFIX docs.
 *
 * @internal Exported for testing purposes
 */
export function getHomeDirPrefix(): string {
	return HOME_PREFIX;
}

function normalizeInstallPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function getDefaultGlobalClaudeDir(): string {
	return normalizeInstallPath(join(homedir(), ".claude"));
}

function getCustomGlobalClaudeDir(targetClaudeDir?: string): string | null {
	if (!targetClaudeDir) return null;

	const normalizedTargetDir = normalizeInstallPath(targetClaudeDir);
	return normalizedTargetDir === getDefaultGlobalClaudeDir() ? null : normalizedTargetDir;
}

function getGlobalClaudePath(targetClaudeDir?: string): string {
	const customGlobalClaudeDir = getCustomGlobalClaudeDir(targetClaudeDir);
	if (customGlobalClaudeDir) {
		return `${customGlobalClaudeDir}/`;
	}

	return `${getHomeDirPrefix()}/.claude/`;
}

function replaceTracked(
	content: string,
	pattern: RegExp,
	replacement: string,
): { content: string; changes: number } {
	let changes = 0;
	const updated = content.replace(pattern, () => {
		changes++;
		return replacement;
	});

	return { content: updated, changes };
}

/**
 * Convert Unix-style path separators to Windows-style when on Windows
 * @internal Exported for testing purposes
 */
export function normalizePathSeparators(path: string): string {
	if (!IS_WINDOWS) return path;
	// Only convert forward slashes in path portions, not in URLs or protocol strings
	return path.replace(/(?<!:)\/(?!\/)/g, "\\");
}

/**
 * File extensions that undergo path transformation during global install
 * Exported for use in release manifest generation
 */
export const TRANSFORMABLE_EXTENSIONS = new Set([
	".md",
	".js",
	".cjs",
	".mjs",
	".ts",
	".py",
	".json",
	".sh",
	".ps1",
	".yaml",
	".yml",
	".toml",
]);

/**
 * Files to always transform regardless of extension
 * Exported for use in release manifest generation
 */
export const ALWAYS_TRANSFORM_FILES = new Set(["CLAUDE.md", "claude.md"]);

/**
 * Transform path references in file content.
 *
 * Handles these patterns:
 * - `./.claude/` → `$HOME/.claude/` (relative path)
 * - `@.claude/` → `@$HOME/.claude/` (@ reference)
 * - `".claude/` → `"$HOME/.claude/` (quoted)
 * - ` .claude/` → ` $HOME/.claude/` (space prefix)
 * - legacy `%USERPROFILE%/.claude/` → `$HOME/.claude/` (normalize broken Windows form)
 * - etc.
 *
 * All platforms emit `$HOME`. Claude Code on Windows runs hooks through a
 * POSIX shell that expands $HOME but not %USERPROFILE% (issue #715).
 *
 * @internal Exported for testing purposes
 */
export function transformContent(
	content: string,
	options: { targetClaudeDir?: string } = {},
): { transformed: string; changes: number } {
	let changes = 0;
	let transformed = content;
	const homePrefix = getHomeDirPrefix();
	const customGlobalClaudeDir = getCustomGlobalClaudeDir(options.targetClaudeDir);
	const claudePath = getGlobalClaudePath(options.targetClaudeDir);

	// Normalize any legacy %USERPROFILE% content to $HOME — covers settings/scripts
	// written by older CLI versions or hand-edited by users following outdated docs.
	// Pattern U1: %USERPROFILE%/.claude/ or %USERPROFILE%\.claude\ → $HOME/.claude/
	const userProfileClaudeResult = replaceTracked(
		transformed,
		/%USERPROFILE%[\\/]\.claude[\\/]/g,
		claudePath,
	);
	transformed = userProfileClaudeResult.content;
	changes += userProfileClaudeResult.changes;

	// Pattern U2: Standalone %USERPROFILE% followed by path separator → $HOME
	const userProfileStandaloneResult = replaceTracked(
		transformed,
		/%USERPROFILE%(?=[\\/])/g,
		homePrefix,
	);
	transformed = userProfileStandaloneResult.content;
	changes += userProfileStandaloneResult.changes;

	// Convert $CLAUDE_PROJECT_DIR to home prefix (for global install transformation)
	// Pattern P1: $CLAUDE_PROJECT_DIR/.claude/ → $HOME/.claude/
	const projectDirPathResult = replaceTracked(
		transformed,
		/\$CLAUDE_PROJECT_DIR\/\.claude\//g,
		claudePath,
	);
	transformed = projectDirPathResult.content;
	changes += projectDirPathResult.changes;

	// Pattern P2: "$CLAUDE_PROJECT_DIR"/.claude/ → "$HOME"/.claude/ (quoted)
	const quotedProjectDirPath = customGlobalClaudeDir
		? `${customGlobalClaudeDir}/`
		: `"${homePrefix}"/.claude/`;
	const quotedProjectDirPathResult = replaceTracked(
		transformed,
		/"\$CLAUDE_PROJECT_DIR"\/\.claude\//g,
		quotedProjectDirPath,
	);
	transformed = quotedProjectDirPathResult.content;
	changes += quotedProjectDirPathResult.changes;

	// Pattern P3: ${CLAUDE_PROJECT_DIR}/.claude/ → ${HOME}/.claude/ (curly brace)
	const braceProjectDirPathResult = replaceTracked(
		transformed,
		/\$\{CLAUDE_PROJECT_DIR\}\/\.claude\//g,
		claudePath,
	);
	transformed = braceProjectDirPathResult.content;
	changes += braceProjectDirPathResult.changes;

	// Normalize legacy %CLAUDE_PROJECT_DIR%/.claude/ → $HOME/.claude/ (issue #715).
	const windowsProjectDirPathResult = replaceTracked(
		transformed,
		/%CLAUDE_PROJECT_DIR%[\\/]\.claude[\\/]/g,
		claudePath,
	);
	transformed = windowsProjectDirPathResult.content;
	changes += windowsProjectDirPathResult.changes;

	// Pattern 1: ./.claude/ → $HOME/.claude/ (remove ./ prefix entirely)
	const relativeClaudePathResult = replaceTracked(transformed, /\.\/\.claude\//g, claudePath);
	transformed = relativeClaudePathResult.content;
	changes += relativeClaudePathResult.changes;

	// Pattern 1b: @./.claude/ → @$HOME/.claude/ (@ with relative path)
	const atRelativeClaudePathResult = replaceTracked(
		transformed,
		/@\.\/\.claude\//g,
		`@${claudePath}`,
	);
	transformed = atRelativeClaudePathResult.content;
	changes += atRelativeClaudePathResult.changes;

	// Pattern 2: @.claude/ → @$HOME/.claude/ (keep @ prefix)
	const atClaudePathResult = replaceTracked(transformed, /@\.claude\//g, `@${claudePath}`);
	transformed = atClaudePathResult.content;
	changes += atClaudePathResult.changes;

	// Pattern 3: Quoted paths ".claude/ or '.claude/ or `.claude/
	transformed = transformed.replace(/(["'`])\.claude\//g, (_match, quote) => {
		changes++;
		return `${quote}${claudePath}`;
	});

	// Pattern 4: Parentheses (.claude/ for markdown links
	const markdownClaudePathResult = replaceTracked(transformed, /\(\.claude\//g, `(${claudePath}`);
	transformed = markdownClaudePathResult.content;
	changes += markdownClaudePathResult.changes;

	// Pattern 5: Space prefix " .claude/" (but not already handled)
	const spacedClaudePathResult = replaceTracked(transformed, / \.claude\//g, ` ${claudePath}`);
	transformed = spacedClaudePathResult.content;
	changes += spacedClaudePathResult.changes;

	// Pattern 6: Start of line ^.claude/
	const lineStartClaudePathResult = replaceTracked(transformed, /^\.claude\//gm, claudePath);
	transformed = lineStartClaudePathResult.content;
	changes += lineStartClaudePathResult.changes;

	// Pattern 7: After colon (YAML/JSON) : .claude/ or :.claude/
	const colonClaudePathResult = replaceTracked(transformed, /: \.claude\//g, `: ${claudePath}`);
	transformed = colonClaudePathResult.content;
	changes += colonClaudePathResult.changes;
	const compactColonClaudePathResult = replaceTracked(
		transformed,
		/:\.claude\//g,
		`:${claudePath}`,
	);
	transformed = compactColonClaudePathResult.content;
	changes += compactColonClaudePathResult.changes;

	if (customGlobalClaudeDir) {
		const customPatterns = [
			{ pattern: /~\/\.claude\//g, replacement: `${customGlobalClaudeDir}/` },
			{ pattern: /~\/\.claude\b/g, replacement: customGlobalClaudeDir },
			{ pattern: /\$HOME\/\.claude\//g, replacement: `${customGlobalClaudeDir}/` },
			{ pattern: /\$HOME\/\.claude\b/g, replacement: customGlobalClaudeDir },
			{ pattern: /\$\{HOME\}\/\.claude\//g, replacement: `${customGlobalClaudeDir}/` },
			{ pattern: /\$\{HOME\}\/\.claude\b/g, replacement: customGlobalClaudeDir },
			{ pattern: /%USERPROFILE%[\\/]\.claude[\\/]/g, replacement: `${customGlobalClaudeDir}/` },
			{ pattern: /%USERPROFILE%[\\/]\.claude\b/g, replacement: customGlobalClaudeDir },
			// Template-specific patterns: exhaustive for current kit templates.
			// Update if new templates use different variable names (e.g., baseDir, userHome).
			{
				pattern: /(?:os\.)?homedir\(\)\s*,\s*(["'])\.claude\1/g,
				replacement: `"${customGlobalClaudeDir}"`,
			},
			{
				pattern: /\b(?:homeDir|homedir)\b\s*,\s*(["'])\.claude\1/g,
				replacement: `"${customGlobalClaudeDir}"`,
			},
		];

		for (const { pattern, replacement } of customPatterns) {
			const customPatternResult = replaceTracked(transformed, pattern, replacement);
			transformed = customPatternResult.content;
			changes += customPatternResult.changes;
		}
	}

	return { transformed, changes };
}

/**
 * Check if a file should be transformed based on extension or name
 * Exported for use in release manifest generation
 */
export function shouldTransformFile(filename: string): boolean {
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
	options: { targetClaudeDir?: string; verbose?: boolean } = {},
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
					const { transformed, changes } = transformContent(content, {
						targetClaudeDir: options.targetClaudeDir,
					});

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
	options: { targetClaudeDir?: string } = {},
): Promise<{ success: boolean; changes: number }> {
	try {
		const content = await readFile(filePath, "utf-8");
		const { transformed, changes } = transformContent(content, options);

		if (changes > 0) {
			await writeFile(filePath, transformed, "utf-8");
		}

		return { success: true, changes };
	} catch (error) {
		return { success: false, changes: 0 };
	}
}
