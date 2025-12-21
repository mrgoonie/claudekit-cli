import { logger } from "@/shared/logger.js";
import type { MigrationDetectionResult, SkillMapping } from "@/types";
import { getAllMigratableSkills, getCategoryForSkill, getPathMapping } from "../skills-mappings.js";
import { scanDirectory } from "./script-detector.js";

/**
 * Generate skill mappings from old to new paths
 *
 * @param currentSkillsDir Current skills directory
 * @param newSkillsDir New skills directory
 * @returns Array of skill mappings
 */
export async function generateSkillMappings(
	currentSkillsDir: string,
	newSkillsDir: string,
): Promise<SkillMapping[]> {
	const mappings: SkillMapping[] = [];
	const [, currentSkills] = await scanDirectory(currentSkillsDir);

	for (const skillName of currentSkills) {
		const mapping = getPathMapping(skillName, currentSkillsDir, newSkillsDir);

		if (mapping) {
			const category = getCategoryForSkill(skillName);
			mappings.push({
				oldPath: mapping.oldPath,
				newPath: mapping.newPath,
				skillName,
				category: category || undefined,
			});
		}
	}

	return mappings;
}

/**
 * Detect migration need using heuristics (when manifest unavailable)
 * Checks for known skill names and directory structure patterns
 *
 * @param oldSkillsDir Path to new release skills directory
 * @param currentSkillsDir Path to current project skills directory
 * @returns Detection result
 */
export async function detectViaHeuristics(
	oldSkillsDir: string,
	currentSkillsDir: string,
): Promise<MigrationDetectionResult> {
	// Scan both directories
	const [oldStructure] = await scanDirectory(oldSkillsDir);
	const [currentStructure, currentSkills] = await scanDirectory(currentSkillsDir);

	// If both are same structure, no migration needed
	if (oldStructure === currentStructure) {
		return {
			status: "not_needed",
			oldStructure,
			newStructure: oldStructure,
			customizations: [],
			skillMappings: [],
		};
	}

	// If current is flat and new is categorized, migration recommended
	if (currentStructure === "flat" && oldStructure === "categorized") {
		logger.info("Migration detected: flat → categorized structure (via heuristics)");

		// Check for known migratable skills
		const migratableSkillsInCurrent = currentSkills.filter((skill) =>
			getAllMigratableSkills().includes(skill),
		);

		if (migratableSkillsInCurrent.length > 0) {
			const mappings = await generateSkillMappings(currentSkillsDir, oldSkillsDir);

			return {
				status: "recommended",
				oldStructure: currentStructure,
				newStructure: oldStructure,
				customizations: [],
				skillMappings: mappings,
			};
		}
	}

	// No migration needed
	return {
		status: "not_needed",
		oldStructure,
		newStructure: oldStructure,
		customizations: [],
		skillMappings: [],
	};
}
