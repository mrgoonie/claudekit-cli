/**
 * Skills domain - skills detection, migration, and management
 */

export { SkillsMigrationDetector } from "./skills-detector.js";
export { SkillsMigrator } from "./skills-migrator.js";
export { SkillsManifestManager } from "./skills-manifest.js";
export { SkillsBackupManager } from "./skills-backup-manager.js";
export { SkillsCustomizationScanner } from "./skills-customization-scanner.js";
export {
	SKILL_CATEGORY_MAPPINGS,
	PRESERVED_SKILLS,
	getCategoryForSkill,
	getAllMigratableSkills,
	getAllCategories,
	isKnownSkill,
	getPathMapping,
	type SkillCategoryMapping,
} from "./skills-mappings.js";
export { SkillsMigrationPrompts } from "./skills-migration-prompts.js";
export * from "./types.js";
