import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, relative } from "node:path";
import type { PortableItem } from "./types.js";

const HOOK_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".sh", ".ps1"]);

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

/** Discover .claude/hooks/ files */
export async function discoverHooks(sourcePath?: string): Promise<PortableItem[]> {
	const path = sourcePath ?? getHooksSourcePath();

	if (!existsSync(path)) {
		return [];
	}

	return discoverPortableFiles(path, path, {
		type: "hooks",
		includeExtensions: HOOK_EXTENSIONS,
		stripExtension: false,
		descriptionPrefix: "Hook",
	});
}

interface DiscoverPortableFileOptions {
	type: "rules" | "hooks";
	includeExtensions: Set<string>;
	stripExtension: boolean;
	descriptionPrefix: "Rule" | "Hook";
}

/** Helper for recursive discovery of portable files */
async function discoverPortableFiles(
	dir: string,
	baseDir: string,
	options: DiscoverPortableFileOptions,
): Promise<PortableItem[]> {
	const items: PortableItem[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;

		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			const nested = await discoverPortableFiles(fullPath, baseDir, options);
			items.push(...nested);
		} else {
			const extension = extname(entry.name).toLowerCase();
			if (!options.includeExtensions.has(extension)) continue;

			const relPath = relative(baseDir, fullPath);
			const normalizedPath = relPath.split(/[/\\]/).join("/");
			const name = options.stripExtension
				? normalizedPath.replace(/\.[^.]+$/, "")
				: normalizedPath;
			const content = await readFile(fullPath, "utf-8");

			items.push({
				name,
				description: `${options.descriptionPrefix}: ${name}`,
				type: options.type,
				sourcePath: fullPath,
				frontmatter: {},
				body: content,
			});
		}
	}

	return items;
}
