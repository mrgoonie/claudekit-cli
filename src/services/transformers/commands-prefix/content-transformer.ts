/**
 * Content Transformer for Command Prefix
 *
 * Transforms slash command references in file contents when --prefix is applied.
 * Changes `/plan:fast` → `/ck:plan:fast`, `/fix:types` → `/ck:fix:types`, etc.
 *
 * This complements prefix-applier.ts which only handles directory restructuring.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

export interface ContentTransformOptions {
	verbose?: boolean;
	dryRun?: boolean;
}

export interface ContentTransformResult {
	filesTransformed: number;
	totalReplacements: number;
}

/**
 * File extensions to process for content transformation
 */
const TRANSFORMABLE_EXTENSIONS = new Set([
	".md",
	".txt",
	".json",
	".yaml",
	".yml",
	".ts",
	".js",
	".mjs",
	".cjs",
	".py",
]);

/**
 * Slash command prefixes to transform
 * These are ClaudeKit commands (not built-in Claude commands like /tasks, /help)
 */
const COMMAND_ROOTS = [
	// Primary workflow commands
	"plan",
	"fix",
	"code",
	"review",
	"cook",
	"brainstorm",
	// Integration & setup
	"integrate",
	"bootstrap",
	"worktree",
	"scout",
	// Utility commands
	"test",
	"debug",
	"preview",
	"kanban",
	"journal",
	"watzup",
];

/**
 * Build regex patterns for command transformation
 *
 * Uses WHITELIST approach: only match slash commands in documentation contexts.
 *
 * DOES match (valid slash command contexts):
 * - Start of line: `/plan:fast task`
 * - After whitespace: `run /plan:fast`
 * - Inside backticks (markdown): `` `/plan:fast` ``
 * - After colon+space in docs: `command: /plan:fast`
 *
 * Does NOT match (false positives to avoid):
 * - File paths: `./test.db`, `../code`, `/home/user/`
 * - HTML tags: `</code>`, `</test>`
 * - String literals in code: `'/kanban'`, `"/kanban"`
 * - URL paths: `/kanban?dir=`, `/api/kanban`
 * - Already prefixed: `/ck:plan:`
 */
function buildCommandPatterns(): Array<{ regex: RegExp; replacement: string }> {
	const patterns: Array<{ regex: RegExp; replacement: string }> = [];

	for (const cmd of COMMAND_ROOTS) {
		// Pattern 1: /cmd:subcommand (with colon separator)
		// Must be preceded by: start of line, whitespace, backtick, or colon+space (for docs)
		// Must NOT be preceded by: word chars, path chars (./), HTML (<), quotes
		// (?!/) at end prevents matching directory paths like /plan:/subdir/
		patterns.push({
			regex: new RegExp(`(?:^|(?<=[\\s\`]))(/)(${cmd})(:)(?!/)`, "gm"),
			replacement: "$1ck:$2$3",
		});

		// Pattern 2: /cmd alone (no subcommand)
		// Same context requirements as Pattern 1
		// Negative lookahead (?![?/=&\w]) excludes URL patterns
		// Positive lookahead requires: whitespace, backtick, brackets, or end of string
		patterns.push({
			regex: new RegExp(`(?:^|(?<=[\\s\`]))(/)(${cmd})(?![?/=&:\\w])(?=[\\s\`\\]\\)]|$)`, "gm"),
			replacement: "$1ck:$2",
		});
	}

	return patterns;
}

/**
 * Transform content by replacing command references
 */
export function transformCommandContent(content: string): { transformed: string; changes: number } {
	let changes = 0;
	let transformed = content;

	const patterns = buildCommandPatterns();

	for (const { regex, replacement } of patterns) {
		regex.lastIndex = 0;
		const matches = transformed.match(regex);
		if (matches) {
			changes += matches.length;
			regex.lastIndex = 0;
			transformed = transformed.replace(regex, replacement);
		}
	}

	return { transformed, changes };
}

/**
 * Check if a file should be transformed based on extension
 */
function shouldTransformFile(filename: string): boolean {
	const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
	return TRANSFORMABLE_EXTENSIONS.has(ext);
}

/**
 * Recursively transform command references in all files
 *
 * @param directory - Root directory to process (typically extractDir/.claude)
 * @param options - Transform options
 * @returns Statistics about transformations made
 */
export async function transformCommandReferences(
	directory: string,
	options: ContentTransformOptions = {},
): Promise<ContentTransformResult> {
	let filesTransformed = 0;
	let totalReplacements = 0;

	async function processDirectory(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules and hidden directories (except .claude)
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
					const { transformed, changes } = transformCommandContent(content);

					if (changes > 0) {
						if (options.dryRun) {
							logger.debug(`[dry-run] Would transform ${changes} command ref(s) in ${fullPath}`);
						} else {
							await writeFile(fullPath, transformed, "utf-8");
							if (options.verbose) {
								logger.verbose(`Transformed ${changes} command ref(s) in ${fullPath}`);
							}
						}
						filesTransformed++;
						totalReplacements += changes;
					}
				} catch (error) {
					// Skip files that can't be read (binary, permissions, etc.)
					logger.debug(
						`Skipped ${fullPath}: ${error instanceof Error ? error.message : "unknown"}`,
					);
				}
			}
		}
	}

	await processDirectory(directory);

	return { filesTransformed, totalReplacements };
}
