import { logger } from "@/shared/logger.js";
import type { MigrationDetectionResult } from "@/types";
import { SkillsManifestManager } from "../skills-manifest.js";
import { generateSkillMappings } from "./dependency-detector.js";

/**
 * Detect migration need using manifest files
 *
 * @param oldSkillsDir Path to new release skills directory
 * @param currentSkillsDir Path to current project skills directory
 * @returns Detection result or null if manifests not found
 */
export async function detectViaManifest(
	oldSkillsDir: string,
	currentSkillsDir: string,
): Promise<MigrationDetectionResult | null> {
	// Read manifests
	const newManifest = await SkillsManifestManager.readManifest(oldSkillsDir);
	const currentManifest = await SkillsManifestManager.readManifest(currentSkillsDir);

	// Need at least new manifest to proceed
	if (!newManifest) {
		return null;
	}

	// If no current manifest, this might be old installation
	if (!currentManifest) {
		// Generate manifest for current directory to detect structure
		try {
			const generatedManifest = await SkillsManifestManager.generateManifest(currentSkillsDir);

			// If current is flat and new is categorized, migration recommended
			if (generatedManifest.structure === "flat" && newManifest.structure === "categorized") {
				logger.info("Migration detected: flat → categorized structure");
				const mappings = await generateSkillMappings(currentSkillsDir, oldSkillsDir);

				return {
					status: "recommended",
					oldStructure: generatedManifest.structure,
					newStructure: newManifest.structure,
					customizations: [],
					skillMappings: mappings,
				};
			}
		} catch (error) {
			logger.warning(
				`Failed to generate current manifest: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return null;
		}
	}

	// Both manifests exist, compare structures
	if (currentManifest && newManifest) {
		if (currentManifest.structure === "flat" && newManifest.structure === "categorized") {
			logger.info("Migration detected: flat → categorized structure (via manifest)");
			const mappings = await generateSkillMappings(currentSkillsDir, oldSkillsDir);

			return {
				status: "recommended",
				oldStructure: currentManifest.structure,
				newStructure: newManifest.structure,
				customizations: [],
				skillMappings: mappings,
			};
		}

		// Same structure, no migration needed
		return {
			status: "not_needed",
			oldStructure: currentManifest.structure,
			newStructure: newManifest.structure,
			customizations: [],
			skillMappings: [],
		};
	}

	return null;
}
