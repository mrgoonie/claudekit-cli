import { logger } from "@/shared/logger.js";
import type { CustomizationDetection, SkillsManifest } from "@/types";
import { detectFileChanges, isSkillCustomized } from "./customization/comparison-engine.js";
import { findSkillPath, scanSkillsDirectory, validatePath } from "./customization/scan-reporter.js";

// Re-export utilities for external use
export { getAllFiles, hashDirectory, hashFile } from "./customization/hash-calculator.js";
export {
	compareDirectories,
	detectFileChanges,
	isSkillCustomized,
} from "./customization/comparison-engine.js";
export { findSkillPath, scanSkillsDirectory, validatePath } from "./customization/scan-reporter.js";

/**
 * Scans skills for user customizations by comparing with baseline
 * Detects added, modified, and deleted files
 */
export class SkillsCustomizationScanner {
	/**
	 * Scan skills for customizations
	 *
	 * @param currentSkillsDir Current project skills directory
	 * @param baselineSkillsDir Baseline skills directory from release (optional)
	 * @param manifest Manifest with baseline hashes (optional)
	 * @returns Array of customization detections
	 */
	static async scanCustomizations(
		currentSkillsDir: string,
		baselineSkillsDir?: string,
		manifest?: SkillsManifest,
	): Promise<CustomizationDetection[]> {
		validatePath(currentSkillsDir, "currentSkillsDir");
		if (baselineSkillsDir) {
			validatePath(baselineSkillsDir, "baselineSkillsDir");
		}

		logger.debug("Scanning skills for customizations...");

		const customizations: CustomizationDetection[] = [];

		// Get list of skills in current directory
		const [, skillNames] = await scanSkillsDirectory(currentSkillsDir);

		for (const skillName of skillNames) {
			// Find actual skill path (handles flat and categorized)
			const skillInfo = await findSkillPath(currentSkillsDir, skillName);

			if (!skillInfo) {
				logger.warning(`Skill directory not found: ${skillName}`);
				continue;
			}

			const { path: skillPath, category: _category } = skillInfo;

			// Find baseline path if baseline provided
			let baselineSkillPath: string | undefined;
			let hasBaseline = false;
			if (baselineSkillsDir) {
				hasBaseline = true;
				const baselineInfo = await findSkillPath(baselineSkillsDir, skillName);
				baselineSkillPath = baselineInfo?.path;
			}

			// Check if skill is customized
			const isCustom = await isSkillCustomized(
				skillPath,
				skillName,
				baselineSkillPath,
				hasBaseline,
				manifest,
			);

			if (isCustom) {
				// Get detailed changes
				const changes = baselineSkillPath
					? await detectFileChanges(skillPath, baselineSkillPath)
					: undefined;

				customizations.push({
					skillName,
					path: skillPath,
					isCustomized: true,
					changes,
				});

				logger.debug(`Detected customizations in skill: ${skillName}`);
			} else {
				customizations.push({
					skillName,
					path: skillPath,
					isCustomized: false,
				});
			}
		}

		logger.info(
			`Found ${customizations.filter((c) => c.isCustomized).length} customized skills out of ${skillNames.length}`,
		);

		return customizations;
	}
}
