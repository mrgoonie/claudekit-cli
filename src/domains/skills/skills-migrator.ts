import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import type { MigrationOptions, MigrationResult } from "@/types";
import { SkillsMigrationError } from "@/types";
import { executeMigration } from "./migrator/migration-executor.js";
import { validateMigrationPath } from "./migrator/migration-validator.js";
import { SkillsBackupManager } from "./skills-backup-manager.js";
import { SkillsCustomizationScanner } from "./skills-customization-scanner.js";
import { SkillsMigrationDetector } from "./skills-detector.js";
import { SkillsManifestManager } from "./skills-manifest.js";
import { SkillsMigrationPrompts } from "./skills-migration-prompts.js";

// Re-export for external use
export { copySkillDirectory, executeMigration } from "./migrator/migration-executor.js";
export { validateMigrationPath } from "./migrator/migration-validator.js";

/**
 * Main migration executor
 * Orchestrates the entire skills migration process
 */
export class SkillsMigrator {
	/**
	 * Execute full migration process
	 *
	 * @param newSkillsDir Path to new skills directory (from release)
	 * @param currentSkillsDir Path to current skills directory (in project)
	 * @param options Migration options
	 * @returns Migration result
	 */
	static async migrate(
		newSkillsDir: string,
		currentSkillsDir: string,
		options: MigrationOptions,
	): Promise<MigrationResult> {
		validateMigrationPath(newSkillsDir, "newSkillsDir");
		validateMigrationPath(currentSkillsDir, "currentSkillsDir");

		logger.info("Starting skills migration process...");

		const result: MigrationResult = {
			success: false,
			migratedSkills: [],
			preservedCustomizations: [],
			errors: [],
		};

		try {
			// Step 1: Detect migration need
			const detection = await SkillsMigrationDetector.detectMigration(
				newSkillsDir,
				currentSkillsDir,
			);

			if (detection.status === "not_needed") {
				logger.info("No migration needed");
				result.success = true;
				return result;
			}

			// Step 2: Scan for customizations
			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				newSkillsDir,
			);

			// Step 3: Interactive prompts (if enabled)
			if (options.interactive) {
				// Ask if user wants to migrate
				const shouldMigrate = await SkillsMigrationPrompts.promptMigrationDecision(detection);

				if (!shouldMigrate) {
					logger.info("Migration cancelled by user");
					result.success = true;
					return result;
				}

				// Show preview
				await SkillsMigrationPrompts.showMigrationPreview(detection.skillMappings, customizations);

				// Ask about backup
				const shouldBackup = await SkillsMigrationPrompts.promptBackup();
				options.backup = shouldBackup;

				// Ask about customization handling
				const customizationStrategy = await SkillsMigrationPrompts.promptCustomizationHandling(
					customizations.filter((c) => c.isCustomized),
				);

				// Filter mappings based on strategy
				if (customizationStrategy === "skip") {
					detection.skillMappings = detection.skillMappings.filter((mapping) => {
						const customization = customizations.find((c) => c.skillName === mapping.skillName);
						return !customization?.isCustomized;
					});
				}
			}

			// Step 4: Create backup if requested
			if (options.backup && !options.dryRun) {
				const claudeDir = join(currentSkillsDir, "..");
				result.backupPath = await SkillsBackupManager.createBackup(currentSkillsDir, claudeDir);
				logger.success(`Backup created at: ${result.backupPath}`);
			}

			// Step 5: Execute migration
			if (!options.dryRun) {
				const migrateResult = await executeMigration(
					detection.skillMappings,
					customizations,
					currentSkillsDir,
					options.interactive,
				);

				result.migratedSkills = migrateResult.migrated;
				result.preservedCustomizations = migrateResult.preserved;
				result.errors = migrateResult.errors;

				// Step 6: Generate new manifest with cleanup on failure
				try {
					const newManifest = await SkillsManifestManager.generateManifest(currentSkillsDir);
					await SkillsManifestManager.writeManifest(currentSkillsDir, newManifest);
					logger.success("Migration manifest generated");
				} catch (manifestError) {
					logger.error(
						`Failed to generate manifest: ${manifestError instanceof Error ? manifestError.message : "Unknown error"}`,
					);
					// Add to errors but don't fail the migration
					result.errors.push({
						skill: "manifest",
						path: currentSkillsDir,
						error: manifestError instanceof Error ? manifestError.message : "Unknown error",
						fatal: false,
					});
				}
			} else {
				logger.info("Dry run mode: No changes made");
			}

			// Step 7: Show summary
			if (options.interactive) {
				SkillsMigrationPrompts.showSummary(
					result.migratedSkills.length,
					result.preservedCustomizations.length,
					0,
					result.errors.filter((e) => e.fatal).length,
				);
			}

			result.success = result.errors.filter((e) => e.fatal).length === 0;

			if (result.success) {
				logger.success("Skills migration completed successfully");
			} else {
				logger.error("Skills migration completed with errors");
			}

			return result;
		} catch (error) {
			// Rollback if backup exists
			if (result.backupPath && !options.dryRun) {
				logger.error("Migration failed, attempting rollback...");
				try {
					await SkillsBackupManager.restoreBackup(result.backupPath, currentSkillsDir);
					logger.success("Rollback successful");
				} catch (rollbackError) {
					logger.error(
						`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : "Unknown error"}`,
					);
				}
			}

			throw new SkillsMigrationError(
				`Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
