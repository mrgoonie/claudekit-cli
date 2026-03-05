/**
 * Agents discovery — finds available agents from ~/.claude/agents/*.md
 */
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";
import { parseFrontmatterFile } from "../portable/frontmatter-parser.js";
import type { PortableItem } from "../portable/types.js";

const home = homedir();

/**
 * Get the agent source directory
 * Priority: project .claude/agents > global ~/.claude/agents
 */
export function getAgentSourcePath(): string | null {
	const paths = [join(process.cwd(), ".claude/agents"), join(home, ".claude/agents")];

	for (const p of paths) {
		if (existsSync(p)) return p;
	}

	return null;
}

/**
 * Discover all available agents from the source directory
 */
export async function discoverAgents(sourcePath?: string): Promise<PortableItem[]> {
	const items: PortableItem[] = [];
	const searchPath = sourcePath || getAgentSourcePath();
	if (!searchPath) return items;

	try {
		const entries = await readdir(searchPath, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

			const filePath = join(searchPath, entry.name);
			try {
				const { frontmatter, body } = await parseFrontmatterFile(filePath);
				const name = entry.name.replace(/\.md$/, "");

				items.push({
					name,
					displayName: frontmatter.name || name,
					description: frontmatter.description || "",
					type: "agent",
					sourcePath: filePath,
					frontmatter,
					body,
				});
			} catch (error) {
				logger.verbose(
					`Failed to parse agent ${entry.name}: ${error instanceof Error ? error.message : "Unknown"}`,
				);
			}
		}
	} catch {
		// Source directory doesn't exist or isn't readable
	}

	return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find a specific agent by name
 */
export async function findAgentByName(
	name: string,
	sourcePath?: string,
): Promise<PortableItem | null> {
	const agents = await discoverAgents(sourcePath);
	return agents.find((a) => a.name.toLowerCase() === name.toLowerCase()) || null;
}
