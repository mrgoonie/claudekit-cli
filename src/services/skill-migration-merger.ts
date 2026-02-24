/**
 * Skill Migration Merger
 * Detects user-modified skills in .claude/skills/ and determines which can be
 * safely deleted (plugin has canonical version) vs which must be preserved
 * as standalone skills due to user customizations.
 *
 * Ownership classification:
 * - "ck": CK-owned, unmodified → safe to delete (plugin replaces)
 * - "ck-modified": user customized a CK skill → preserve as standalone
 * - "user": user-created skill → never touch
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import type { TrackedFile } from "@/types/metadata.js";
import { pathExists } from "fs-extra";

export interface SkillMigrationResult {
	/** Skills kept as standalone in .claude/skills/ due to user edits */
	preserved: string[];
	/** Skills safe to delete (plugin has canonical version) */
	deleted: string[];
	/** User-created skills (not managed by CK, left untouched) */
	userOwned: string[];
}

/**
 * Analyze tracked skill files and categorize by ownership for migration.
 *
 * @param claudeDir - Path to user's .claude directory
 * @param pluginVerified - Whether plugin installation was verified
 * @returns Categorized skill directories
 */
export async function migrateUserSkills(
	claudeDir: string,
	pluginVerified: boolean,
): Promise<SkillMigrationResult> {
	const result: SkillMigrationResult = { preserved: [], deleted: [], userOwned: [] };

	if (!pluginVerified) {
		// Plugin not installed — keep all skills as-is, nothing to migrate
		return result;
	}

	// Read user metadata to get tracked files
	const metadataPath = join(claudeDir, "metadata.json");
	if (!(await pathExists(metadataPath))) {
		return result;
	}

	let trackedFiles: TrackedFile[];
	try {
		const content = await readFile(metadataPath, "utf-8");
		const metadata = JSON.parse(content);
		// Extract tracked files from multi-kit or legacy format
		trackedFiles = extractTrackedSkillFiles(metadata);
	} catch {
		logger.debug("Could not read metadata for skill migration");
		return result;
	}

	if (trackedFiles.length === 0) {
		return result;
	}

	// Categorize by ownership, deduplicating by skill directory
	const preservedSet = new Set<string>();
	const deletedSet = new Set<string>();
	const userOwnedSet = new Set<string>();

	for (const file of trackedFiles) {
		// Extract skill directory name: "skills/<name>/..." → "skills/<name>"
		const parts = file.path.split("/");
		if (parts.length < 2) continue;
		const skillDir = `${parts[0]}/${parts[1]}`;

		switch (file.ownership) {
			case "user":
				userOwnedSet.add(skillDir);
				break;
			case "ck-modified":
				preservedSet.add(skillDir);
				break;
			case "ck":
				deletedSet.add(skillDir);
				break;
		}
	}

	// If any file in a skill dir is ck-modified, preserve the whole skill
	// (ck-modified takes priority over ck for same skill dir)
	for (const dir of preservedSet) {
		deletedSet.delete(dir);
	}

	result.preserved = [...preservedSet];
	result.deleted = [...deletedSet];
	result.userOwned = [...userOwnedSet];

	// Log preserved skills for user awareness
	for (const dir of result.preserved) {
		const skillName = dir.split("/")[1];
		logger.info(`Preserved customizations: /${skillName} (standalone alongside /ck:${skillName})`);
	}

	return result;
}

/**
 * Extract tracked files under skills/ from metadata (any format).
 */
function extractTrackedSkillFiles(metadata: Record<string, unknown>): TrackedFile[] {
	const files: TrackedFile[] = [];

	// Multi-kit format: metadata.kits.engineer.files
	if (metadata.kits && typeof metadata.kits === "object") {
		for (const kit of Object.values(metadata.kits as Record<string, { files?: TrackedFile[] }>)) {
			if (kit.files) {
				files.push(...kit.files.filter((f) => f.path.startsWith("skills/")));
			}
		}
	}

	// Legacy format: metadata.files
	if (Array.isArray(metadata.files)) {
		files.push(...(metadata.files as TrackedFile[]).filter((f) => f.path.startsWith("skills/")));
	}

	return files;
}
