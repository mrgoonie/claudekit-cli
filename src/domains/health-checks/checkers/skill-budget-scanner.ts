import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import matter from "gray-matter";

// "scripts" and "common" are ClaudeKit Engineer utility directories that hold no SKILL.md files.
// Directories named scripts/common that DO contain a direct SKILL.md are still found (checked before this set is consulted).
const SKIP_DIRS = new Set([".git", ".venv", "__pycache__", "node_modules", "scripts", "common"]);

export interface SkillMeta {
	id: string;
	description: string;
	file: string;
	userInvocable?: boolean;
}

export async function scanSkills(skillsDir: string): Promise<SkillMeta[]> {
	if (!existsSync(skillsDir)) return [];
	const skillDirs = await findSkillDirs(skillsDir);
	const skills: SkillMeta[] = [];
	for (const dir of skillDirs) {
		const file = join(dir, "SKILL.md");
		try {
			const content = await readFile(file, "utf8");
			const { data } = matter(content, { engines: { javascript: { parse: () => ({}) } } });
			const rawName = typeof data.name === "string" ? data.name : "";
			const fallbackId = relative(skillsDir, dir).replace(/\\/g, "/") || basename(dir);
			skills.push({
				id: normalizeSkillId(rawName, fallbackId),
				description: typeof data.description === "string" ? data.description : "",
				file,
				userInvocable:
					typeof data["user-invocable"] === "boolean" ? data["user-invocable"] : undefined,
			});
		} catch {
			// Malformed skills are handled by other skill validators; skip here.
		}
	}
	return skills;
}

async function findSkillDirs(dir: string): Promise<string[]> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const results: string[] = [];
	for (const entry of entries) {
		const child = join(dir, entry.name);
		if (existsSync(join(child, "SKILL.md"))) {
			results.push(child);
			continue;
		}
		if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP_DIRS.has(entry.name)) continue;
		results.push(...(await findSkillDirs(child)));
	}
	return results;
}

function normalizeSkillId(rawName: string, fallbackId: string): string {
	if (!rawName) return fallbackId;
	return rawName.startsWith("ck:") ? rawName.slice(3) : rawName;
}
