/**
 * Skill Reader - Parses SKILL.md files from ~/.claude/skills/
 * Extracts metadata from YAML frontmatter
 */
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";

export interface SkillInfo {
	id: string;
	name: string;
	description: string;
	path: string;
}

interface SkillMetadata {
	name: string;
	description: string;
}

/**
 * List all skills with their metadata
 */
export async function listSkills(): Promise<SkillInfo[]> {
	const skillsDir = join(PathResolver.getGlobalKitDir(), "skills");

	if (!existsSync(skillsDir)) {
		return [];
	}

	try {
		const entries = await readdir(skillsDir);
		const skills: SkillInfo[] = [];

		for (const entry of entries) {
			const entryPath = join(skillsDir, entry);
			const stats = await stat(entryPath);

			if (stats.isDirectory()) {
				const skillMdPath = join(entryPath, "SKILL.md");
				const metadata = await parseSkillMd(skillMdPath);

				skills.push({
					id: entry,
					name: metadata.name || entry,
					description: metadata.description || "",
					path: entryPath,
				});
			}
		}

		return skills.sort((a, b) => a.name.localeCompare(b.name));
	} catch (error) {
		logger.error(`Failed to list skills: ${error}`);
		return [];
	}
}

/**
 * Parse SKILL.md file and extract frontmatter metadata
 */
export async function parseSkillMd(path: string): Promise<SkillMetadata> {
	const defaultMetadata: SkillMetadata = {
		name: "",
		description: "",
	};

	if (!existsSync(path)) {
		return defaultMetadata;
	}

	try {
		const content = await readFile(path, "utf-8");
		return extractFrontmatter(content);
	} catch (error) {
		logger.debug(`Failed to parse SKILL.md at ${path}: ${error}`);
		return defaultMetadata;
	}
}

/**
 * Extract YAML frontmatter from markdown content
 * Format:
 * ---
 * name: Skill Name
 * description: Skill description
 * ---
 */
function extractFrontmatter(content: string): SkillMetadata {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

	if (!frontmatterMatch) {
		return { name: "", description: "" };
	}

	const frontmatter = frontmatterMatch[1];
	const metadata: SkillMetadata = { name: "", description: "" };

	// Parse simple YAML key: value pairs
	const lines = frontmatter.split("\n");
	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.substring(0, colonIndex).trim().toLowerCase();
			let value = line.substring(colonIndex + 1).trim();

			// Remove surrounding quotes if present
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			if (key === "name") {
				metadata.name = value;
			} else if (key === "description") {
				metadata.description = value;
			}
		}
	}

	return metadata;
}
