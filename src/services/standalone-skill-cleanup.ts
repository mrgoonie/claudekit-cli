/**
 * Standalone Skill Cleanup
 * After plugin installation, removes standalone skill copies from ~/.claude/skills/
 * that are also provided by the CK plugin. This ensures users see /ck:skill-name
 * (plugin namespace) instead of /skill-name (standalone).
 *
 * Strategy: backup-then-remove. All overlapping standalone skills are moved to
 * ~/.claude/skills/.backup/ before deletion. If a backup already exists for a skill,
 * the existing backup is preserved (first backup wins = idempotent).
 *
 * Safety: Only removes skills confirmed to exist in the plugin's skills/ dir.
 */

import { readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { ensureDir, pathExists, remove } from "fs-extra";

const BACKUP_DIR_NAME = ".backup";

export interface OverlapCleanupResult {
	/** Standalone skill dirs removed (backed up + deleted) */
	removed: string[];
	/** Standalone skill dirs skipped (backup already existed = prior run) */
	skipped: string[];
	/** Standalone skill dirs that failed to process */
	errors: string[];
	/** Plugin skills dir path used for comparison */
	pluginSkillsDir: string;
}

/**
 * List subdirectory names containing SKILL.md within a given directory.
 */
async function listSkillDirs(dir: string): Promise<Set<string>> {
	if (!(await pathExists(dir))) return new Set();
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		const dirs = entries.filter((e) => e.isDirectory() && e.name !== BACKUP_DIR_NAME);
		const results = await Promise.all(
			dirs.map(async (e) => {
				const exists = await pathExists(join(dir, e.name, "SKILL.md"));
				return exists ? e.name : null;
			}),
		);
		return new Set(results.filter(Boolean) as string[]);
	} catch {
		return new Set();
	}
}

/**
 * Scan for standalone skills that overlap with plugin skills, back them up, then remove.
 * Idempotent: if backup already exists for a skill, skip it (prior run already handled).
 *
 * @param claudeDir - Path to user's .claude directory (e.g. ~/.claude)
 * @param pluginSkillsDir - Path to the plugin's skills directory
 */
export async function cleanupOverlappingStandaloneSkills(
	claudeDir: string,
	pluginSkillsDir: string,
): Promise<OverlapCleanupResult> {
	const standaloneSkillsDir = join(claudeDir, "skills");
	const backupDir = join(standaloneSkillsDir, BACKUP_DIR_NAME);

	const result: OverlapCleanupResult = {
		removed: [],
		skipped: [],
		errors: [],
		pluginSkillsDir,
	};

	const [pluginSkills, standaloneSkills] = await Promise.all([
		listSkillDirs(pluginSkillsDir),
		listSkillDirs(standaloneSkillsDir),
	]);

	if (pluginSkills.size === 0 || standaloneSkills.size === 0) {
		logger.debug(
			`standalone-skill-cleanup: nothing to clean (plugin=${pluginSkills.size}, standalone=${standaloneSkills.size})`,
		);
		return result;
	}

	// Find overlapping skills (same name in both locations)
	const overlaps = [...standaloneSkills].filter((name) => pluginSkills.has(name));
	if (overlaps.length === 0) return result;

	// Ensure backup dir exists before moving anything
	await ensureDir(backupDir);

	for (const skillName of overlaps) {
		const skillPath = join(standaloneSkillsDir, skillName);
		const backupPath = join(backupDir, skillName);

		try {
			// Idempotent: if backup already exists, this skill was handled in a prior run
			if (await pathExists(backupPath)) {
				// Prior backup exists — just ensure the standalone is gone
				if (await pathExists(skillPath)) {
					await remove(skillPath);
					result.removed.push(skillName);
					logger.debug(`standalone-skill-cleanup: removed residual ${skillName} (backup exists)`);
				} else {
					result.skipped.push(skillName);
					logger.debug(`standalone-skill-cleanup: skipped ${skillName} (already cleaned)`);
				}
				continue;
			}

			// First run: backup then remove
			await rename(skillPath, backupPath);
			result.removed.push(skillName);
			logger.debug(`standalone-skill-cleanup: backed up + removed ${skillName}`);
		} catch (error) {
			result.errors.push(skillName);
			logger.debug(`standalone-skill-cleanup: failed ${skillName}: ${error}`);
		}
	}

	if (result.removed.length > 0) {
		logger.debug(
			`standalone-skill-cleanup: backups at ${backupDir} (recoverable with 'mv .backup/<skill> ../')`,
		);
	}

	return result;
}
