import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import type {
	CustomizationDetection,
	MigrationError,
	MigrationOptions,
	MigrationResult,
	SkillMapping,
} from "../types.js";
import { SkillsMigrationError } from "../types.js";
import { logger } from "../utils/logger.js";
import { SkillsBackupManager } from "./skills-backup-manager.js";
import { SkillsCustomizationScanner } from "./skills-customization-scanner.js";
import { SkillsMigrationDetector } from "./skills-detector.js";
import { SkillsManifestManager } from "./skills-manifest.js";
import { SkillsMigrationPrompts } from "./skills-migration-prompts.js";

/**
 * Validate path input to prevent security issues
 */
function validatePath(path: string, paramName: string): void {
	if (!path || typeof path !== "string") {
		throw new SkillsMigrationError(`${paramName} must be a non-empty string`);
	}

	// Check for path length limits to prevent DoS
	if (path.length > 1000) {
		throw new SkillsMigrationError(`${paramName} path too long (max 1000 characters)`);
	}

	// Check for path traversal attempts
	// Note: Windows uses ~ in short path format (e.g., C:\Users\RUNNER~1\...), which is safe
	// Only reject ~ in non-Windows absolute paths (Unix home directory expansion)
	const isWindowsAbsolutePath = /^[A-Za-z]:[/\\]/.test(path);
	const hasDangerousTilde = path.includes("~") && !isWindowsAbsolutePath;

	if (path.includes("..") || hasDangerousTilde) {
		throw new SkillsMigrationError(
			`${paramName} contains potentially dangerous path traversal: ${path}`,
		);
	}

	// Check for dangerous characters that could cause filesystem issues
	if (/[<>:"|?*]/.test(path)) {
		throw new SkillsMigrationError(`${paramName} contains invalid characters: ${path}`);
	}

	// Additional check for control characters
	for (let i = 0; i < path.length; i++) {
		const charCode = path.charCodeAt(i);
		if (charCode < 32 || charCode === 127) {
			throw new SkillsMigrationError(`${paramName} contains control characters: ${path}`);
		}
	}
}

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
		validatePath(newSkillsDir, "newSkillsDir");
		validatePath(currentSkillsDir, "currentSkillsDir");

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
				const migrateResult = await SkillsMigrator.executeMigration(
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

	/**
	 * Execute actual migration (file movements)
	 *
	 * @param mappings Skill mappings
	 * @param customizations Customization detections
	 * @param currentSkillsDir Current skills directory
	 * @param newSkillsDir New skills directory
	 * @param interactive Interactive mode
	 * @returns Migration statistics
	 */
	private static async executeMigration(
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
					const targetPath = category
						? join(tempDir, category, skillName)
						: join(tempDir, skillName);

					// Create category directory if needed
					if (category) {
						await mkdir(join(tempDir, category), { recursive: true });
					}

					// Copy skill directory
					await SkillsMigrator.copySkillDirectory(currentSkillPath, targetPath);

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
			await SkillsMigrator.copySkillDirectory(tempDir, currentSkillsDir);

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
	 * Copy skill directory recursively
	 *
	 * @param sourceDir Source directory
	 * @param destDir Destination directory
	 */
	private static async copySkillDirectory(sourceDir: string, destDir: string): Promise<void> {
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
				await SkillsMigrator.copySkillDirectory(sourcePath, destPath);
			} else if (entry.isFile()) {
				await copyFile(sourcePath, destPath);
			}
		}
	}
}
