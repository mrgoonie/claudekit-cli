import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import type { MigrationDetectionResult, SkillMapping } from "@/types";
import { pathExists } from "fs-extra";
import { SkillsManifestManager } from "./skills-manifest.js";
import { getAllMigratableSkills, getCategoryForSkill, getPathMapping } from "./skills-mappings.js";

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
		const manifestResult = await SkillsMigrationDetector.detectViaManifest(
			oldSkillsDir,
			currentSkillsDir,
		);
		if (manifestResult !== null) {
			logger.debug("Detected migration via manifest");
			return manifestResult;
		}

		// Fallback to heuristic detection
		logger.debug("Manifest not found, using heuristic detection");
		return await SkillsMigrationDetector.detectViaHeuristics(oldSkillsDir, currentSkillsDir);
	}

	/**
	 * Detect migration need using manifest files
	 *
	 * @param oldSkillsDir Path to new release skills directory
	 * @param currentSkillsDir Path to current project skills directory
	 * @returns Detection result or null if manifests not found
	 */
	private static async detectViaManifest(
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
					const mappings = await SkillsMigrationDetector.generateSkillMappings(
						currentSkillsDir,
						oldSkillsDir,
					);

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
				const mappings = await SkillsMigrationDetector.generateSkillMappings(
					currentSkillsDir,
					oldSkillsDir,
				);

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

	/**
	 * Detect migration need using heuristics (when manifest unavailable)
	 * Checks for known skill names and directory structure patterns
	 *
	 * @param oldSkillsDir Path to new release skills directory
	 * @param currentSkillsDir Path to current project skills directory
	 * @returns Detection result
	 */
	private static async detectViaHeuristics(
		oldSkillsDir: string,
		currentSkillsDir: string,
	): Promise<MigrationDetectionResult> {
		// Scan both directories
		const [oldStructure] = await SkillsMigrationDetector.scanDirectory(oldSkillsDir);
		const [currentStructure, currentSkills] =
			await SkillsMigrationDetector.scanDirectory(currentSkillsDir);

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
				const mappings = await SkillsMigrationDetector.generateSkillMappings(
					currentSkillsDir,
					oldSkillsDir,
				);

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

	/**
	 * Scan directory to detect structure and list skills
	 *
	 * @param skillsDir Path to skills directory
	 * @returns Tuple of [structure, skill names]
	 */
	private static async scanDirectory(
		skillsDir: string,
	): Promise<["flat" | "categorized", string[]]> {
		if (!(await pathExists(skillsDir))) {
			return ["flat", []];
		}

		const entries = await readdir(skillsDir, { withFileTypes: true });
		const dirs = entries.filter(
			(entry) =>
				entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith("."),
		);

		if (dirs.length === 0) {
			return ["flat", []];
		}

		// Check all directories to determine structure (not just first one)
		// This handles mixed structures and different directory ordering on Windows
		let totalSkillLikeCount = 0;
		const allSkills: string[] = [];

		for (const dir of dirs) {
			const dirPath = join(skillsDir, dir.name);
			const subEntries = await readdir(dirPath, { withFileTypes: true });
			const subdirs = subEntries.filter(
				(entry) => entry.isDirectory() && !entry.name.startsWith("."),
			);

			// Check if this directory has subdirectories that look like skills
			if (subdirs.length > 0) {
				for (const subdir of subdirs.slice(0, 3)) {
					// Check first 3 subdirs
					const subdirPath = join(dirPath, subdir.name);
					const subdirFiles = await readdir(subdirPath, { withFileTypes: true });
					// A skill directory typically has skill.md, README.md, or config.json at root
					const hasSkillMarker = subdirFiles.some(
						(file) =>
							file.isFile() &&
							(file.name === "skill.md" ||
								file.name === "README.md" ||
								file.name === "readme.md" ||
								file.name === "config.json" ||
								file.name === "package.json"),
					);
					if (hasSkillMarker) {
						totalSkillLikeCount++;
						allSkills.push(subdir.name);
					}
				}
			}
		}

		// If we found subdirectories with skill markers, it's categorized
		if (totalSkillLikeCount > 0) {
			return ["categorized", allSkills];
		}

		// Flat structure
		return ["flat", dirs.map((dir) => dir.name)];
	}

	/**
	 * Generate skill mappings from old to new paths
	 *
	 * @param currentSkillsDir Current skills directory
	 * @param newSkillsDir New skills directory
	 * @returns Array of skill mappings
	 */
	private static async generateSkillMappings(
		currentSkillsDir: string,
		newSkillsDir: string,
	): Promise<SkillMapping[]> {
		const mappings: SkillMapping[] = [];
		const [, currentSkills] = await SkillsMigrationDetector.scanDirectory(currentSkillsDir);

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
}
