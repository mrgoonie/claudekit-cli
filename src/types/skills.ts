/**
 * Skills migration types and schemas
 */
import { z } from "zod";

// Skills migration types
export const SkillsManifestSchema = z.object({
	version: z.string(), // Manifest schema version (e.g., "1.0.0")
	structure: z.enum(["flat", "categorized"]), // Skills directory structure type
	timestamp: z.string(), // ISO 8601 timestamp of manifest creation
	skills: z.array(
		z.object({
			name: z.string(), // Skill directory name
			category: z.string().optional(), // Category (for categorized structure)
			hash: z.string().optional(), // SHA-256 hash of skill contents (for change detection)
		}),
	),
});
export type SkillsManifest = z.infer<typeof SkillsManifestSchema>;

// Migration status
export type MigrationStatus = "not_needed" | "recommended" | "required";

// Migration detection result
export interface MigrationDetectionResult {
	status: MigrationStatus;
	oldStructure: "flat" | "categorized" | null;
	newStructure: "flat" | "categorized" | null;
	customizations: CustomizationDetection[];
	skillMappings: SkillMapping[];
}

// Customization detection
export interface CustomizationDetection {
	skillName: string;
	path: string;
	isCustomized: boolean;
	changes?: FileChange[];
}

// File change detection
export interface FileChange {
	file: string;
	type: "added" | "modified" | "deleted";
	oldHash?: string;
	newHash?: string;
}

// Skill mapping (old → new structure)
export interface SkillMapping {
	oldPath: string;
	newPath: string;
	skillName: string;
	category?: string;
}

// Migration options
export interface MigrationOptions {
	interactive: boolean;
	backup: boolean;
	dryRun: boolean;
}

// Migration result
export interface MigrationResult {
	success: boolean;
	backupPath?: string;
	migratedSkills: string[];
	preservedCustomizations: string[];
	errors: MigrationError[];
}

// Migration error
export interface MigrationError {
	skill: string;
	path: string;
	error: string;
	fatal: boolean;
}
