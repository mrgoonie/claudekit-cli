import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { withProcessLock } from "@/shared/process-lock.js";
import type { CustomizationDetection, MigrationError, SkillMapping } from "@/types";
import { pathExists } from "fs-extra";
import { SkillsMigrationPrompts } from "../skills-migration-prompts.js";

/**
 * Copy skill directory recursively
 *
 * @param sourceDir Source directory
 * @param destDir Destination directory
 */
export async function copySkillDirectory(sourceDir: string, destDir: string): Promise<void> {
	await mkdir(destDir, { recursive: true });

	const entries = await readdir(sourceDir, { withFileTypes: true });

	for (const entry of entries) {
		const sourcePath = join(sourceDir, entry.name);
		const destPath = join(destDir, entry.name);

		// Skip hidden files, node_modules, and symlinks
		if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.isSymbolicLink()) {
			continue;
		}

		if (entry.isDirectory()) {
			await copySkillDirectory(sourcePath, destPath);
		} else if (entry.isFile()) {
			await copyFile(sourcePath, destPath);
		}
	}
}

/**
 * Internal migration implementation
 *
 * @param mappings Skill mappings
 * @param customizations Customization detections
 * @param currentSkillsDir Current skills directory
 * @param interactive Interactive mode
 * @returns Migration statistics
 */
async function executeInternal(
	mappings: SkillMapping[],
	customizations: CustomizationDetection[],
	currentSkillsDir: string,
	interactive: boolean,
): Promise<{
	migrated: string[];
	preserved: string[];
	errors: MigrationError[];
}> {
	const migrated: string[] = [];
	const preserved: string[] = [];
	const errors: MigrationError[] = [];

	// Create temporary directory for reorganization
	const tempDir = join(currentSkillsDir, "..", ".skills-migration-temp");
	await mkdir(tempDir, { recursive: true });

	try {
		// Step 1: Copy skills to temp directory with new structure
		for (const mapping of mappings) {
			try {
				const skillName = mapping.skillName;
				const currentSkillPath = mapping.oldPath;

				// Skip if skill doesn't exist
				if (!(await pathExists(currentSkillPath))) {
					logger.warning(`Skill not found, skipping: ${skillName}`);
					continue;
				}

				// Check if customized
				const customization = customizations.find((c) => c.skillName === skillName);
				const isCustomized = customization?.isCustomized || false;

				// Interactive confirmation for customized skills
				if (interactive && isCustomized && customization) {
					const shouldMigrate = await SkillsMigrationPrompts.promptSkillMigration(
						skillName,
						customization,
					);

					if (!shouldMigrate) {
						logger.info(`Skipped: ${skillName}`);
						continue;
					}
				}

				// Determine target path
				const category = mapping.category;
				const targetPath = category ? join(tempDir, category, skillName) : join(tempDir, skillName);

				// Create category directory if needed
				if (category) {
					await mkdir(join(tempDir, category), { recursive: true });
				}

				// Copy skill directory
				await copySkillDirectory(currentSkillPath, targetPath);

				migrated.push(skillName);

				if (isCustomized) {
					preserved.push(skillName);
				}

				logger.debug(`Migrated: ${skillName} → ${category || "root"}`);
			} catch (error) {
				errors.push({
					skill: mapping.skillName,
					path: mapping.oldPath,
					error: error instanceof Error ? error.message : "Unknown error",
					fatal: false,
				});

				logger.error(
					`Failed to migrate ${mapping.skillName}: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}

		// Step 2: Remove old skills directory
		await rm(currentSkillsDir, { recursive: true, force: true });

		// Step 3: Rename temp directory to skills
		await mkdir(currentSkillsDir, { recursive: true });
		await copySkillDirectory(tempDir, currentSkillsDir);

		// Step 4: Cleanup temp directory
		await rm(tempDir, { recursive: true, force: true });

		return { migrated, preserved, errors };
	} catch (error) {
		// Cleanup temp directory on error
		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}

		throw error;
	}
}

/**
 * Execute actual migration (file movements) with process locking
 *
 * @param mappings Skill mappings
 * @param customizations Customization detections
 * @param currentSkillsDir Current skills directory
 * @param interactive Interactive mode
 * @returns Migration statistics
 */
export async function executeMigration(
	mappings: SkillMapping[],
	customizations: CustomizationDetection[],
	currentSkillsDir: string,
	interactive: boolean,
): Promise<{
	migrated: string[];
	preserved: string[];
	errors: MigrationError[];
}> {
	// Wrap migration with lock to prevent concurrent migrations
	return withProcessLock("migration", async () => {
		return executeInternal(mappings, customizations, currentSkillsDir, interactive);
	});
}
