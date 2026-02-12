import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, relative } from "node:path";
import type { PortableItem } from "./types.js";

/** Get default config source path */
export function getConfigSourcePath(): string {
	return join(homedir(), ".claude", "CLAUDE.md");
}

/** Get default rules source path */
export function getRulesSourcePath(): string {
	return join(homedir(), ".claude", "rules");
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

	return discoverMdFiles(path, path);
}

/** Helper for recursive discovery of .md files */
async function discoverMdFiles(dir: string, baseDir: string): Promise<PortableItem[]> {
	const items: PortableItem[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;

		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			const nested = await discoverMdFiles(fullPath, baseDir);
			items.push(...nested);
		} else if (extname(entry.name) === ".md") {
			const relPath = relative(baseDir, fullPath);
			const name = relPath.replace(/\.md$/, "").split(/[/\\]/).join("/");
			const content = await readFile(fullPath, "utf-8");

			items.push({
				name,
				description: `Rule: ${name}`,
				type: "rules",
				sourcePath: fullPath,
				frontmatter: {},
				body: content,
			});
		}
	}

	return items;
}
