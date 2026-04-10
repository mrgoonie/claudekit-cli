/**
 * Skill discovery - finds available skills from ClaudeKit source
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { findFirstExistingPath, getProjectLayoutCandidates } from "@/shared/kit-layout.js";
import matter from "gray-matter";
import { validateSkillFrontmatter } from "../../domains/skills/skill-frontmatter-validator.js";
import { logger } from "../../shared/logger.js";
import type { EnrichedSkillInfo, SkillInfo } from "./types.js";

const home = homedir();

// Directories to skip during discovery
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", ".venv", "__pycache__", "common"];

/**
 * Get the skill source directory
 * Priority: bundled with engineer package > global ~/.claude/skills
 */
export function getSkillSourcePath(): string | null {
	const bundledRoot = join(process.cwd(), "node_modules", "claudekit-engineer");
	return findFirstExistingPath([
		join(bundledRoot, "skills"),
		...getProjectLayoutCandidates(bundledRoot, "skills"),
		...getProjectLayoutCandidates(process.cwd(), "skills"),
		join(home, ".claude/skills"),
	]);
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
		// CRITICAL: disable JS engine to prevent code execution from untrusted SKILL.md files
		const { data } = matter(content, { engines: { javascript: { parse: () => ({}) } } });

		// Always use directory name as canonical ID to prevent duplicate installs
		const skillDir = dirname(skillMdPath);
		const dirName = skillDir.split(/[/\\]/).pop() || "";
		if (!dirName) {
			logger.verbose(`Skipping ${skillMdPath}: cannot determine skill directory`);
			return null;
		}

		// Support agentskills.io spec: version/author under metadata, with top-level fallback
		const metadata =
			data.metadata && typeof data.metadata === "object"
				? (data.metadata as Record<string, unknown>)
				: undefined;
		const version = metadata?.version ?? data.version;
		const author = metadata?.author;

		return {
			name: dirName, // Use directory name as canonical ID
			displayName: data.name, // Store frontmatter name separately for display
			description: data.description || "",
			version: version != null ? String(version) : undefined,
			author: author != null ? String(author) : undefined,
			license: data.license,
			path: skillDir,
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
 * Coerce a YAML value to string array
 */
function toStringArray(v: unknown): string[] | undefined {
	if (Array.isArray(v)) return v.map(String).filter(Boolean);
	if (typeof v === "string") return v.split(/,\s*/).filter(Boolean);
	return undefined;
}

/**
 * Extract /ck:command-name cross-references from markdown body
 * Skips code fences to avoid false positives
 */
function extractCrossRefs(body: string): string[] {
	// Remove code fences before scanning
	const stripped = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
	const refs = new Set<string>();
	const pattern = /\/ck:([a-z0-9-]+)/g;
	for (const match of stripped.matchAll(pattern)) {
		refs.add(match[1]);
	}
	return Array.from(refs);
}

/**
 * Discover skills with enriched metadata from frontmatter and body analysis.
 * Extends discoverSkills() by re-reading each SKILL.md for additional fields.
 */
export async function discoverSkillsEnriched(sourcePath?: string): Promise<EnrichedSkillInfo[]> {
	const base = await discoverSkills(sourcePath);
	const enriched: EnrichedSkillInfo[] = [];

	for (const skill of base) {
		const skillMdPath = join(skill.path, "SKILL.md");
		try {
			const content = await readFile(skillMdPath, "utf-8");
			// CRITICAL: disable JS engine to prevent code execution from untrusted SKILL.md files
			const { data, content: body } = matter(content, {
				engines: { javascript: { parse: () => ({}) } },
			});

			// Validate frontmatter against schema (warn-only)
			const validation = validateSkillFrontmatter(data as Record<string, unknown>, skill.name);
			for (const w of validation.warnings) logger.verbose(w);

			enriched.push({
				...skill,
				category: data.category != null ? String(data.category) : undefined,
				keywords: toStringArray(data.keywords),
				requires: toStringArray(data.requires),
				related: toStringArray(data.related),
				maturity: data.maturity != null ? String(data.maturity) : undefined,
				crossRefs: extractCrossRefs(body),
			});
		} catch {
			// If we can't enrich, keep base info
			enriched.push({ ...skill });
		}
	}

	return enriched;
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
