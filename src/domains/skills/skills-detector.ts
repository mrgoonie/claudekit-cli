import { logger } from "@/shared/logger.js";
import type { MigrationDetectionResult } from "@/types";
import { pathExists } from "fs-extra";
import { detectViaManifest } from "./detection/config-detector.js";
import { detectViaHeuristics } from "./detection/dependency-detector.js";

// Re-export for external use
export { scanDirectory } from "./detection/script-detector.js";
export { detectViaManifest } from "./detection/config-detector.js";
export { detectViaHeuristics, generateSkillMappings } from "./detection/dependency-detector.js";

/**
 * Detects if skills migration is needed by comparing old and new structures
 * Supports manifest-based detection with heuristic fallback
 */
export class SkillsMigrationDetector {
	/**
	 * Detect if migration is needed
	 *
	 * @param oldSkillsDir Path to old skills directory (e.g., in temp download)
	 * @param currentSkillsDir Path to current skills directory (e.g., in project)
	 * @returns Detection result with migration status and mappings
	 */
	static async detectMigration(
		oldSkillsDir: string,
		currentSkillsDir: string,
	): Promise<MigrationDetectionResult> {
		logger.debug("Detecting skills migration need...");

		// Check if skills directories exist
		const oldExists = await pathExists(oldSkillsDir);
		const currentExists = await pathExists(currentSkillsDir);

		if (!oldExists && !currentExists) {
			logger.debug("No skills directories found, migration not needed");
			return {
				status: "not_needed",
				oldStructure: null,
				newStructure: null,
				customizations: [],
				skillMappings: [],
			};
		}

		if (!currentExists) {
			// New installation, no migration needed
			logger.debug("No current skills directory, migration not needed");
			return {
				status: "not_needed",
				oldStructure: null,
				newStructure: null,
				customizations: [],
				skillMappings: [],
			};
		}

		// Try manifest-based detection first
		const manifestResult = await detectViaManifest(oldSkillsDir, currentSkillsDir);
		if (manifestResult !== null) {
			logger.debug("Detected migration via manifest");
			return manifestResult;
		}

		// Fallback to heuristic detection
		logger.debug("Manifest not found, using heuristic detection");
		return await detectViaHeuristics(oldSkillsDir, currentSkillsDir);
	}
}
