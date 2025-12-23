/**
 * Scan ~/.claude/skills/ for skill directories with SKILL.md
 */

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";

export interface Skill {
	id: string;
	name: string;
	description: string;
	category: string;
	isAvailable: boolean;
}

interface SkillFrontmatter {
	name?: string;
	description?: string;
	category?: string;
	license?: string;
}

const skillsDir = join(homedir(), ".claude", "skills");
const SKIP_DIRS = [".venv", "scripts", "__pycache__", "node_modules", ".git", "common"];

/**
 * Parse SKILL.md frontmatter to extract metadata
 */
export async function getSkillMetadata(skillPath: string): Promise<SkillFrontmatter | null> {
	const skillMdPath = join(skillPath, "SKILL.md");
	if (!existsSync(skillMdPath)) return null;

	try {
		const content = await readFile(skillMdPath, "utf-8");
		const { data } = matter(content);
		return data as SkillFrontmatter;
	} catch {
		return null;
	}
}

/**
 * Infer category from skill directory name or metadata
 */
function inferCategory(name: string, metadata: SkillFrontmatter | null): string {
	if (metadata?.category) return metadata.category;

	// Infer from name patterns
	const lowerName = name.toLowerCase();
	if (lowerName.includes("auth") || lowerName.includes("security")) return "Security";
	if (lowerName.includes("debug") || lowerName.includes("test")) return "Development";
	if (lowerName.includes("ui") || lowerName.includes("frontend") || lowerName.includes("design"))
		return "UI/UX";
	if (lowerName.includes("backend") || lowerName.includes("api")) return "Backend";
	if (lowerName.includes("database") || lowerName.includes("db")) return "Database";
	if (lowerName.includes("devops") || lowerName.includes("deploy")) return "DevOps";
	if (lowerName.includes("ai") || lowerName.includes("ml")) return "AI";
	if (lowerName.includes("research")) return "Research";

	return "General";
}

/**
 * Scan all skills in ~/.claude/skills/
 */
export async function scanSkills(): Promise<Skill[]> {
	if (!existsSync(skillsDir)) return [];

	try {
		const entries = await readdir(skillsDir);
		const skills: Skill[] = [];

		for (const entry of entries) {
			// Skip non-skill directories
			if (SKIP_DIRS.includes(entry)) continue;

			const entryPath = join(skillsDir, entry);
			const skillMdPath = join(entryPath, "SKILL.md");

			// Only include directories with SKILL.md
			if (!existsSync(skillMdPath)) continue;

			const metadata = await getSkillMetadata(entryPath);

			skills.push({
				id: entry,
				name: metadata?.name || entry,
				description: metadata?.description || "",
				category: inferCategory(entry, metadata),
				isAvailable: true,
			});
		}

		// Sort alphabetically by name
		skills.sort((a, b) => a.name.localeCompare(b.name));
		return skills;
	} catch {
		return [];
	}
}
