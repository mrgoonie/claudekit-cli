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
	// Metadata.json enrichment fields
	kit?: string;
	installedVersion?: string;
	sourceTimestamp?: string;
	installedAt?: string;
	isCustomized?: boolean;
}

interface SkillFrontmatter {
	name?: string;
	description?: string;
	category?: string;
	license?: string;
}

const skillsDir = join(homedir(), ".claude", "skills");
const SKIP_DIRS = [".venv", "scripts", "__pycache__", "node_modules", ".git", "common"];

/** Enriched metadata for a CK-owned skill directory */
interface SkillMetadataEntry {
	kit: string;
	installedVersion: string;
	sourceTimestamp: string;
	installedAt: string;
	checksums: Map<string, string>; // relativePath -> checksum
}

/**
 * Read CK-owned skill metadata from metadata.json
 * Checks both global (~/.claude/metadata.json) and project (.claude/metadata.json)
 * Returns Map<dirName, SkillMetadataEntry> for enriching skills, or null if no metadata
 */
async function getCkSkillMetadata(
	scope: "global" | "project",
): Promise<Map<string, SkillMetadataEntry> | null> {
	const metaPath =
		scope === "global"
			? join(homedir(), ".claude", "metadata.json")
			: join(process.cwd(), ".claude", "metadata.json");

	if (!existsSync(metaPath)) return null;

	const result = new Map<string, SkillMetadataEntry>();

	try {
		const content = await readFile(metaPath, "utf-8");
		const data = JSON.parse(content);

		for (const [kitName, kitData] of Object.entries(data.kits || {})) {
			const kit = kitData as {
				version?: string;
				installedAt?: string;
				files?: Array<{
					path: string;
					ownership?: string;
					checksum?: string;
					installedVersion?: string;
					sourceTimestamp?: string;
					installedAt?: string;
				}>;
			};
			if (!Array.isArray(kit.files)) continue;

			for (const file of kit.files) {
				if (file.ownership !== "ck") continue;
				const parts = file.path.split("/");
				if (parts.length < 3 || parts[0] !== "skills") continue;

				const dirName = parts[1];
				if (!result.has(dirName)) {
					result.set(dirName, {
						kit: kitName,
						installedVersion: file.installedVersion || kit.version || "",
						sourceTimestamp: file.sourceTimestamp || "",
						installedAt: file.installedAt || kit.installedAt || "",
						checksums: new Map(),
					});
				}
				if (file.checksum) {
					result.get(dirName)?.checksums.set(file.path, file.checksum);
				}
			}
		}
	} catch {
		// Corrupted or unreadable metadata, skip
	}

	return result.size > 0 ? result : null;
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
		const [globalMeta, projectMeta] = await Promise.all([
			getCkSkillMetadata("global"),
			getCkSkillMetadata("project"),
		]);
		// Merge: global is primary, project supplements
		const ckMeta = globalMeta ?? projectMeta;
		const skills: Skill[] = [];

		for (const entry of entries) {
			if (SKIP_DIRS.includes(entry)) continue;

			// Filter to CK-owned dirs when metadata is available
			if (ckMeta && !ckMeta.has(entry)) continue;

			const entryPath = join(skillsDir, entry);
			const skillMdPath = join(entryPath, "SKILL.md");
			if (!existsSync(skillMdPath)) continue;

			const frontmatter = await getSkillMetadata(entryPath);
			const meta = ckMeta?.get(entry);

			// Detect customization: both global and project have this skill with different checksums
			let isCustomized = false;
			if (globalMeta?.has(entry) && projectMeta?.has(entry)) {
				const gEntry = globalMeta.get(entry);
				const pEntry = projectMeta.get(entry);
				if (gEntry && pEntry) {
					for (const [path, gHash] of gEntry.checksums) {
						const pHash = pEntry.checksums.get(path);
						if (pHash && pHash !== gHash) {
							isCustomized = true;
							break;
						}
					}
				}
			}

			skills.push({
				id: entry,
				name: frontmatter?.name || entry,
				description: frontmatter?.description || "",
				category: inferCategory(entry, frontmatter),
				isAvailable: true,
				kit: meta?.kit,
				installedVersion: meta?.installedVersion,
				sourceTimestamp: meta?.sourceTimestamp,
				installedAt: meta?.installedAt,
				isCustomized: isCustomized || undefined,
			});
		}

		skills.sort((a, b) => a.name.localeCompare(b.name));
		return skills;
	} catch {
		return [];
	}
}
