/**
 * Scan ~/.claude/skills/ for skill directories with SKILL.md
 * Filters to CK-owned skills using metadata.json ownership tracking
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
 * Read CK-owned skill directory names from metadata.json
 * Checks both global (~/.claude/metadata.json) and project (.claude/metadata.json)
 * Extracts unique skill dirs from files with path "skills/<dir>/..." and ownership "ck"
 */
async function getCkOwnedSkillDirs(): Promise<Set<string> | null> {
	const metadataPaths = [
		join(homedir(), ".claude", "metadata.json"),
		join(process.cwd(), ".claude", "metadata.json"),
	];

	const ckDirs = new Set<string>();

	for (const metaPath of metadataPaths) {
		if (!existsSync(metaPath)) continue;

		try {
			const content = await readFile(metaPath, "utf-8");
			const data = JSON.parse(content);

			// Iterate all kits (engineer, marketing, etc.)
			for (const kit of Object.values(data.kits || {})) {
				const files = (kit as { files?: Array<{ path: string; ownership?: string }> }).files;
				if (!Array.isArray(files)) continue;

				for (const file of files) {
					if (file.ownership !== "ck") continue;
					const parts = file.path.split("/");
					// Match "skills/<dirname>/..." (at least 3 parts = has a file inside)
					if (parts.length >= 3 && parts[0] === "skills") {
						ckDirs.add(parts[1]);
					}
				}
			}
		} catch {
			// Corrupted or unreadable metadata, skip
		}
	}

	// Return null if no metadata found (fall back to showing all skills)
	return ckDirs.size > 0 ? ckDirs : null;
}

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
 * Scan CK-owned skills in ~/.claude/skills/
 * Uses metadata.json to filter to only CK-managed skill directories
 * Falls back to showing all skills with SKILL.md if no metadata found
 */
export async function scanSkills(): Promise<Skill[]> {
	if (!existsSync(skillsDir)) return [];

	try {
		const entries = await readdir(skillsDir);
		const ckDirs = await getCkOwnedSkillDirs();
		const skills: Skill[] = [];

		for (const entry of entries) {
			// Skip non-skill directories
			if (SKIP_DIRS.includes(entry)) continue;

			// Filter to CK-owned dirs when metadata is available
			if (ckDirs && !ckDirs.has(entry)) continue;

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
