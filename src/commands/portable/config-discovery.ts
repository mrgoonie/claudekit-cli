import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, relative } from "node:path";
import type { PortableItem } from "./types.js";

/** Node-runnable hook scripts — what Claude Code settings.json references via `node` command */
const HOOK_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts"]);

/** Shell/batch hook extensions that are skipped (not node-runnable) */
const SHELL_HOOK_EXTENSIONS = new Set([".sh", ".ps1", ".bat", ".cmd"]);

/** Get default config source path */
export function getConfigSourcePath(): string {
	return join(homedir(), ".claude", "CLAUDE.md");
}

/** Get default rules source path */
export function getRulesSourcePath(): string {
	return join(homedir(), ".claude", "rules");
}

/** Get default hooks source path (project preferred, then global fallback). */
export function getHooksSourcePath(): string {
	const projectPath = join(process.cwd(), ".claude", "hooks");
	if (existsSync(projectPath)) {
		return projectPath;
	}
	return join(homedir(), ".claude", "hooks");
}

/** Discover CLAUDE.md config file */
export async function discoverConfig(sourcePath?: string): Promise<PortableItem | null> {
	const path = sourcePath ?? getConfigSourcePath();

	if (!existsSync(path)) {
		return null;
	}

	const content = await readFile(path, "utf-8");

	return {
		name: "CLAUDE",
		description: "Project configuration",
		type: "config",
		sourcePath: path,
		frontmatter: {},
		body: content,
	};
}

/** Discover .claude/rules/ files */
export async function discoverRules(sourcePath?: string): Promise<PortableItem[]> {
	const path = sourcePath ?? getRulesSourcePath();

	if (!existsSync(path)) {
		return [];
	}

	return discoverPortableFiles(path, path, {
		type: "rules",
		includeExtensions: new Set([".md"]),
		stripExtension: true,
		descriptionPrefix: "Rule",
	});
}

/** Result of hook discovery including any skipped shell hook filenames */
export interface HookDiscoveryResult {
	items: PortableItem[];
	skippedShellHooks: string[];
}

/** Discover .claude/hooks/ files. Returns node-runnable hooks and names of skipped shell hooks. */
export async function discoverHooks(sourcePath?: string): Promise<HookDiscoveryResult> {
	const path = sourcePath ?? getHooksSourcePath();

	if (!existsSync(path)) {
		return { items: [], skippedShellHooks: [] };
	}

	// Single readdir pass — classify entries into node-runnable and shell hooks
	let entries: Array<import("node:fs").Dirent<string>>;
	try {
		entries = await readdir(path, { withFileTypes: true, encoding: "utf8" });
	} catch {
		return { items: [], skippedShellHooks: [] };
	}

	const skippedShellHooks: string[] = [];
	const items: PortableItem[] = [];

	for (const entry of entries) {
		if (!entry.isFile() || entry.name.startsWith(".")) continue;
		const ext = extname(entry.name).toLowerCase();
		if (SHELL_HOOK_EXTENSIONS.has(ext)) {
			skippedShellHooks.push(entry.name);
			continue;
		}
		if (!HOOK_EXTENSIONS.has(ext)) continue;
		const fullPath = join(path, entry.name);
		try {
			const content = await readFile(fullPath, "utf-8");
			items.push({
				name: entry.name,
				description: `Hook: ${entry.name}`,
				type: "hooks",
				sourcePath: fullPath,
				frontmatter: {},
				body: content,
			});
		} catch (_err) {
			// Individual file read errors are non-fatal — skip and continue discovery
		}
	}

	return { items, skippedShellHooks };
}

interface DiscoverPortableFileOptions {
	type: "rules" | "hooks";
	includeExtensions: Set<string>;
	stripExtension: boolean;
	descriptionPrefix: "Rule" | "Hook";
	/**
	 * Whether to recurse into subdirectories (default: true).
	 * Hooks are top-level only — callers of discoverPortableFiles for hooks should set this to false.
	 */
	recursive?: boolean;
}

/** Helper for recursive discovery of portable files */
async function discoverPortableFiles(
	dir: string,
	baseDir: string,
	options: DiscoverPortableFileOptions,
): Promise<PortableItem[]> {
	const items: PortableItem[] = [];
	let entries: Array<import("node:fs").Dirent<string>>;
	try {
		entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
	} catch {
		return items;
	}

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;

		const fullPath = join(dir, entry.name);

		if (entry.isSymbolicLink()) {
			continue;
		}

		if (entry.isDirectory()) {
			if (options.recursive ?? true) {
				const nested = await discoverPortableFiles(fullPath, baseDir, options);
				items.push(...nested);
			}
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		const extension = extname(entry.name).toLowerCase();
		if (!options.includeExtensions.has(extension)) continue;

		const relPath = relative(baseDir, fullPath);
		const normalizedPath = relPath.split(/[/\\]/).join("/");
		const name = options.stripExtension ? normalizedPath.replace(/\.[^.]+$/, "") : normalizedPath;

		try {
			const content = await readFile(fullPath, "utf-8");

			items.push({
				name,
				description: `${options.descriptionPrefix}: ${name}`,
				type: options.type,
				sourcePath: fullPath,
				frontmatter: {},
				body: content,
			});
		} catch (_err) {
			// Individual file read errors are non-fatal — skip and continue discovery
		}
	}

	return items;
}
