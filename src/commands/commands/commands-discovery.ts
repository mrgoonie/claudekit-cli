/**
 * Commands discovery — finds available commands from ~/.claude/commands/*.md
 * Supports nested directories (e.g., docs/init.md -> docs:init)
 */
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { findFirstExistingPath, getProjectLayoutCandidates } from "@/shared/kit-layout.js";
import { logger } from "../../shared/logger.js";
import { parseFrontmatterFile } from "../portable/frontmatter-parser.js";
import type { PortableItem } from "../portable/types.js";

// Directories to skip during discovery
const SKIP_DIRS = ["node_modules", ".git", "dist", "build"];

/**
 * Get the command source directory.
 *
 * @param globalOnly When true, skip project (CWD) candidates and resolve directly
 *   to ~/.claude/commands. Used by `ck migrate -g` so SOURCE follows DESTINATION scope.
 *   Defaults to false: project .claude/commands > global ~/.claude/commands.
 */
export function getCommandSourcePath(globalOnly = false): string | null {
	const globalPath = join(homedir(), ".claude/commands");
	if (globalOnly) {
		return findFirstExistingPath([globalPath]);
	}
	return findFirstExistingPath([
		...getProjectLayoutCandidates(process.cwd(), "commands"),
		globalPath,
	]);
}

/**
 * Recursively discover command files, supporting nested directories
 */
async function scanCommandDir(dir: string, rootDir: string): Promise<PortableItem[]> {
	const items: PortableItem[] = [];

	try {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				if (SKIP_DIRS.includes(entry.name)) continue;
				// Recurse into subdirectories
				const nested = await scanCommandDir(fullPath, rootDir);
				items.push(...nested);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				try {
					const { frontmatter, body } = await parseFrontmatterFile(fullPath);

					// Compute relative path segments for nested commands
					const relPath = relative(rootDir, fullPath);
					const segments = relPath.replace(/\.md$/, "").split(/[/\\]/);
					// Use / as separator for nested to avoid collision with flat files
					// docs/init.md -> name: docs/init (no collision with docs-init.md -> docs-init)
					const name = segments.join("/");
					const displayName = segments.join(":"); // Display: docs:init

					items.push({
						name,
						displayName,
						description: frontmatter.description || "",
						type: "command",
						sourcePath: fullPath,
						frontmatter,
						body,
						segments,
					});
				} catch (error) {
					logger.verbose(
						`Failed to parse command ${entry.name}: ${error instanceof Error ? error.message : "Unknown"}`,
					);
				}
			}
		}
	} catch {
		// Directory not readable
	}

	return items;
}

/**
 * Discover all available commands from the source directory
 */
export async function discoverCommands(sourcePath?: string): Promise<PortableItem[]> {
	const searchPath = sourcePath || getCommandSourcePath();
	if (!searchPath) return [];

	const items = await scanCommandDir(searchPath, searchPath);
	return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find a specific command by name
 */
export async function findCommandByName(
	name: string,
	sourcePath?: string,
): Promise<PortableItem | null> {
	const commands = await discoverCommands(sourcePath);
	return (
		commands.find((c) => c.name.toLowerCase() === name.toLowerCase()) ||
		commands.find((c) => c.displayName?.toLowerCase() === name.toLowerCase()) ||
		null
	);
}
