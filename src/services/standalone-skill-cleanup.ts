/**
 * Standalone Skill Cleanup
 * After plugin installation, removes standalone skill copies from ~/.claude/skills/
 * that are also provided by the CK plugin. This ensures users see /ck:skill-name
 * (plugin namespace) instead of /skill-name (standalone).
 *
 * Safety: Only removes skills confirmed to exist in the plugin's skills/ dir.
 * User-owned skills (tracked as "user" in metadata) are never deleted.
 */

import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { TrackedFile } from "@/types/metadata.js";
import { pathExists, remove } from "fs-extra";

export interface OverlapCleanupResult {
	/** Standalone skill dirs removed (replaced by plugin) */
	removed: string[];
	/** Standalone skill dirs preserved (user-owned or modified) */
	preserved: string[];
	/** Plugin skills dir path used for comparison */
	pluginSkillsDir: string;
}

/**
 * List subdirectory names containing SKILL.md within a given directory.
 */
async function listSkillDirs(dir: string): Promise<Set<string>> {
	if (!(await pathExists(dir))) return new Set();
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		const names = new Set<string>();
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const skillMd = join(dir, entry.name, "SKILL.md");
				if (await pathExists(skillMd)) {
					names.add(entry.name);
				}
			}
		}
		return names;
	} catch {
		return new Set();
	}
}

/**
 * Extract all tracked skill files from metadata (any format).
 * Returns map of skill dir name -> ownership.
 * If a dir has any "user" or "ck-modified" file, mark as non-deletable.
 */
async function getSkillOwnershipMap(claudeDir: string): Promise<Map<string, "ck" | "user">> {
	const ownershipMap = new Map<string, "ck" | "user">();
	const metadataPath = join(claudeDir, "metadata.json");

	if (!(await pathExists(metadataPath))) return ownershipMap;

	let trackedFiles: TrackedFile[];
	try {
		const content = await readFile(metadataPath, "utf-8");
		const metadata = JSON.parse(content) as Record<string, unknown>;
		trackedFiles = extractTrackedSkillFiles(metadata);
	} catch {
		logger.debug("standalone-skill-cleanup: could not read metadata");
		return ownershipMap;
	}

	for (const file of trackedFiles) {
		const skillDirName = extractSkillDirName(file.path);
		if (!skillDirName) continue;

		const existing = ownershipMap.get(skillDirName);
		// "user" or "ck-modified" takes priority — preserve if any file is user-owned/modified
		if (file.ownership === "user" || file.ownership === "ck-modified") {
			ownershipMap.set(skillDirName, "user");
		} else if (!existing) {
			ownershipMap.set(skillDirName, "ck");
		}
	}

	return ownershipMap;
}

function extractTrackedSkillFiles(metadata: Record<string, unknown>): TrackedFile[] {
	const files: TrackedFile[] = [];

	if (metadata.kits && typeof metadata.kits === "object") {
		for (const kit of Object.values(metadata.kits as Record<string, { files?: TrackedFile[] }>)) {
			if (kit.files) {
				files.push(...kit.files.filter((f) => f.path?.startsWith("skills/")));
			}
		}
	}

	if (Array.isArray(metadata.files)) {
		files.push(...(metadata.files as TrackedFile[]).filter((f) => f.path?.startsWith("skills/")));
	}

	return files;
}

function extractSkillDirName(filePath: string): string | null {
	const normalized = filePath.replace(/\\/g, "/");
	const parts = normalized.split("/").filter(Boolean);
	if (parts.length < 2 || parts[0] !== "skills") return null;
	return parts[1];
}

/**
 * Scan for standalone skills that overlap with plugin skills and remove them.
 * Preserves user-owned and user-modified skills.
 *
 * @param claudeDir - Path to user's .claude directory (e.g. ~/.claude)
 */
export async function cleanupOverlappingStandaloneSkills(
	claudeDir: string,
): Promise<OverlapCleanupResult> {
	const pluginSkillsDir = join(
		PathResolver.getClaudeKitDir(),
		"marketplace",
		"plugins",
		"ck",
		"skills",
	);
	const standaloneSkillsDir = join(claudeDir, "skills");

	const result: OverlapCleanupResult = {
		removed: [],
		preserved: [],
		pluginSkillsDir,
	};

	const [pluginSkills, standaloneSkills] = await Promise.all([
		listSkillDirs(pluginSkillsDir),
		listSkillDirs(standaloneSkillsDir),
	]);

	if (pluginSkills.size === 0 || standaloneSkills.size === 0) return result;

	// Find overlapping skills (same name in both locations)
	const overlaps = [...standaloneSkills].filter((name) => pluginSkills.has(name));
	if (overlaps.length === 0) return result;

	// Get ownership info from metadata
	const ownershipMap = await getSkillOwnershipMap(claudeDir);

	for (const skillName of overlaps) {
		const ownership = ownershipMap.get(skillName);
		const skillPath = join(standaloneSkillsDir, skillName);

		// Preserve if user-owned or modified
		if (ownership === "user") {
			result.preserved.push(skillName);
			logger.debug(`standalone-skill-cleanup: preserved ${skillName} (user-owned)`);
			continue;
		}

		try {
			await remove(skillPath);
			result.removed.push(skillName);
			logger.debug(`standalone-skill-cleanup: removed standalone ${skillName} (plugin has it)`);
		} catch (error) {
			// Non-fatal: preserve on error
			result.preserved.push(skillName);
			logger.debug(`standalone-skill-cleanup: could not remove ${skillName}: ${error}`);
		}
	}

	return result;
}
