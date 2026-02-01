import { existsSync } from "node:fs";
/**
 * Skill discovery - finds available skills from ClaudeKit source
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import { logger } from "../../shared/logger.js";
import type { SkillInfo } from "./types.js";

const home = homedir();

// Directories to skip during discovery
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".venv", "__pycache__", "common"];

/**
 * Get the skill source directory
 * Priority: bundled with engineer package > global ~/.claude/skills
 */
export function getSkillSourcePath(): string | null {
	// Check for bundled skills in claudekit-engineer (future)
	const bundledPaths = [
		join(process.cwd(), "node_modules/claudekit-engineer/skills"),
		join(process.cwd(), ".claude/skills"),
	];

	for (const path of bundledPaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	// Fall back to global skills directory
	const globalSkillsPath = join(home, ".claude/skills");
	if (existsSync(globalSkillsPath)) {
		return globalSkillsPath;
	}

	return null;
}

/**
 * Check if a directory contains a valid SKILL.md
 */
async function hasSkillMd(dir: string): Promise<boolean> {
	try {
		const skillPath = join(dir, "SKILL.md");
		const stats = await stat(skillPath);
		return stats.isFile();
	} catch {
		return false;
	}
}

/**
 * Parse SKILL.md frontmatter to extract skill info
 */
async function parseSkillMd(skillMdPath: string): Promise<SkillInfo | null> {
	try {
		const content = await readFile(skillMdPath, "utf-8");
		const { data } = matter(content);

		// Always use directory name as canonical ID to prevent duplicate installs
		const dirName = dirname(skillMdPath).split("/").pop() || "";
		if (!dirName) {
			logger.verbose(`Skipping ${skillMdPath}: cannot determine skill directory`);
			return null;
		}

		return {
			name: dirName, // Use directory name as canonical ID
			displayName: data.name, // Store frontmatter name separately for display
			description: data.description || "",
			version: data.version,
			license: data.license,
			path: dirname(skillMdPath),
		};
	} catch (error) {
		// Log parsing errors (malformed YAML, binary files, etc.)
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		logger.verbose(`Failed to parse ${skillMdPath}: ${errorMsg}`);
		return null;
	}
}

/**
 * Discover all available skills from the source directory
 */
export async function discoverSkills(sourcePath?: string): Promise<SkillInfo[]> {
	const skills: SkillInfo[] = [];
	const seenNames = new Set<string>();

	const searchPath = sourcePath || getSkillSourcePath();
	if (!searchPath) {
		return skills;
	}

	try {
		const entries = await readdir(searchPath, { withFileTypes: true });

		for (const entry of entries) {
			// Skip non-directories and special directories
			if (!entry.isDirectory() || SKIP_DIRS.includes(entry.name)) {
				continue;
			}

			const skillDir = join(searchPath, entry.name);

			// Check if this directory has a SKILL.md
			if (await hasSkillMd(skillDir)) {
				const skill = await parseSkillMd(join(skillDir, "SKILL.md"));
				if (skill && !seenNames.has(skill.name)) {
					skills.push(skill);
					seenNames.add(skill.name);
				}
			}
		}
	} catch {
		// Source directory doesn't exist or isn't readable
	}

	// Sort alphabetically by name
	return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find a specific skill by name
 */
export async function findSkillByName(
	name: string,
	sourcePath?: string,
): Promise<SkillInfo | null> {
	const skills = await discoverSkills(sourcePath);
	return skills.find((s) => s.name.toLowerCase() === name.toLowerCase()) || null;
}
