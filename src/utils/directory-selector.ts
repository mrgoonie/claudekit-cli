import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { minimatch } from "minimatch";
import { logger } from "./logger.js";
import { PathResolver } from "./path-resolver.js";

export interface DirectoryItem {
	name: string;
	path: string;
	type: "directory" | "file";
	children?: DirectoryItem[];
	relativePath: string;
}

export interface SelectionState {
	[itemPath: string]: boolean;
}

/**
 * Scan a directory and build a tree structure
 */
export async function scanDirectoryTree(
	sourceDir: string,
	relativeTo: string = sourceDir,
	maxDepth = 3,
): Promise<DirectoryItem[]> {
	const items: DirectoryItem[] = [];

	try {
		const entries = await readdir(sourceDir);

		for (const entry of entries) {
			const fullPath = join(sourceDir, entry);
			const relativePath = relativeTo
				? fullPath.replace(relativeTo, "").replace(/^[\\/]/, "")
				: entry;

			try {
				const stats = await stat(fullPath);

				if (stats.isDirectory()) {
					const children =
						maxDepth > 0 ? await scanDirectoryTree(fullPath, relativeTo, maxDepth - 1) : [];

					items.push({
						name: entry,
						path: fullPath,
						type: "directory",
						children,
						relativePath,
					});
				} else {
					items.push({
						name: entry,
						path: fullPath,
						type: "file",
						relativePath,
					});
				}
			} catch (error) {
				// Skip files/directories that can't be accessed
				logger.debug(`Skipping ${entry}: ${error}`);
			}
		}
	} catch (error) {
		logger.debug(`Error reading directory ${sourceDir}: ${error}`);
	}

	// Sort items: directories first, then files, both alphabetically
	return items.sort((a, b) => {
		if (a.type !== b.type) {
			return a.type === "directory" ? -1 : 1;
		}
		return a.name.localeCompare(b.name);
	});
}

/**
 * Filter directory items by patterns
 */
export function filterItemsByPatterns(items: DirectoryItem[], patterns: string[]): DirectoryItem[] {
	if (patterns.length === 0) {
		return items;
	}

	const filteredItems: DirectoryItem[] = [];

	for (const item of items) {
		// Check if item matches any pattern using minimatch for security
		const matches = patterns.some((pattern) => {
			return (
				minimatch(item.relativePath, pattern, { dot: true }) ||
				(item.type === "directory" && minimatch(`${item.relativePath}/`, pattern, { dot: true }))
			);
		});

		if (matches) {
			// If it's a directory, include all its children
			if (item.type === "directory" && item.children) {
				filteredItems.push({
					...item,
					children: item.children,
				});
			} else {
				filteredItems.push(item);
			}
		} else if (item.type === "directory" && item.children) {
			// Check if any children match
			const matchingChildren = filterItemsByPatterns(item.children, patterns);
			if (matchingChildren.length > 0) {
				filteredItems.push({
					...item,
					children: matchingChildren,
				});
			}
		}
	}

	return filteredItems;
}

/**
 * Flatten selected items into relative paths
 */
export function flattenSelectedItems(
	items: DirectoryItem[],
	selection: SelectionState,
	relativeTo = "",
): string[] {
	const paths: string[] = [];

	for (const item of items) {
		const itemPath = relativeTo ? join(relativeTo, item.name) : item.name;

		if (selection[item.relativePath]) {
			if (item.type === "directory") {
				// Include entire directory
				paths.push(`${itemPath}/**`);
			} else {
				paths.push(itemPath);
			}
		} else if (item.type === "directory" && item.children) {
			// Recursively check children
			paths.push(...flattenSelectedItems(item.children, selection, itemPath));
		}
	}

	return paths;
}

/**
 * Get default directories for ClaudeKit structure
 *
 * @param global - Whether to use global installation mode
 */
export function getClaudeKitDirectories(global = false): {
	category: string;
	pattern: string;
	description: string;
}[] {
	const prefix = PathResolver.getPathPrefix(global);
	const base = prefix || "";
	return [
		{
			category: "Core",
			pattern: base ? `${base}/**` : "**",
			description: "Core ClaudeKit configuration and components",
		},
		{
			category: "Agents",
			pattern: base ? `${base}/agents/**` : "agents/**",
			description: "AI agents for different tasks (researcher, planner, etc.)",
		},
		{
			category: "Commands",
			pattern: base ? `${base}/commands/**` : "commands/**",
			description: "CLI commands and automation scripts",
		},
		{
			category: "Workflows",
			pattern: base ? `${base}/workflows/**` : "workflows/**",
			description: "Development workflows and processes",
		},
		{
			category: "Skills",
			pattern: base ? `${base}/skills/**` : "skills/**",
			description: "Specialized skills and integrations",
		},
		{
			category: "Hooks",
			pattern: base ? `${base}/hooks/**` : "hooks/**",
			description: "Git hooks and automation triggers",
		},
	];
}

/**
 * Create default selection state for items
 */
export function createDefaultSelection(items: DirectoryItem[]): SelectionState {
	const selection: SelectionState = {};

	const processItem = (item: DirectoryItem) => {
		selection[item.relativePath] = false;
		if (item.children) {
			item.children.forEach(processItem);
		}
	};

	items.forEach(processItem);
	return selection;
}
