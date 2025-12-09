/**
 * Command options schemas and types
 */
import { z } from "zod";
import { KitType } from "./kit.js";

// Exclude pattern validation schema
export const ExcludePatternSchema = z
	.string()
	.trim()
	.min(1, "Exclude pattern cannot be empty")
	.max(500, "Exclude pattern too long")
	.refine((val) => !val.startsWith("/"), "Absolute paths not allowed in exclude patterns")
	.refine((val) => !val.includes(".."), "Path traversal not allowed in exclude patterns");

// Custom folder configuration schema
// Allows users to customize default folder names (docs/, plans/) to avoid conflicts
export const FoldersConfigSchema = z.object({
	docs: z.string().optional(), // Custom docs folder name (default: "docs")
	plans: z.string().optional(), // Custom plans folder name (default: "plans")
});
export type FoldersConfig = z.infer<typeof FoldersConfigSchema>;

// Default folder names
export const DEFAULT_FOLDERS: Required<FoldersConfig> = {
	docs: "docs",
	plans: "plans",
};

// Command options schemas
export const NewCommandOptionsSchema = z.object({
	dir: z.string().default("."),
	kit: KitType.optional(),
	release: z.string().optional(),
	force: z.boolean().default(false),
	exclude: z.array(ExcludePatternSchema).optional().default([]),
	opencode: z.boolean().default(false),
	gemini: z.boolean().default(false),
	installSkills: z.boolean().default(false),
	prefix: z.boolean().default(false),
	beta: z.boolean().default(false),
	dryRun: z.boolean().default(false), // Preview changes without applying
	refresh: z.boolean().default(false), // Bypass release cache to fetch latest versions
	docsDir: z.string().optional(), // Custom docs folder name
	plansDir: z.string().optional(), // Custom plans folder name
});
export type NewCommandOptions = z.infer<typeof NewCommandOptionsSchema>;

export const UpdateCommandOptionsSchema = z.object({
	dir: z.string().default("."),
	kit: KitType.optional(),
	release: z.string().optional(),
	exclude: z.array(ExcludePatternSchema).optional().default([]),
	only: z.array(ExcludePatternSchema).optional().default([]),
	global: z.boolean().default(false),
	fresh: z.boolean().default(false),
	installSkills: z.boolean().default(false),
	prefix: z.boolean().default(false),
	beta: z.boolean().default(false),
	dryRun: z.boolean().default(false), // Preview changes without applying
	forceOverwrite: z.boolean().default(false), // Override ownership protections
	forceOverwriteSettings: z.boolean().default(false), // Skip selective merge, fully replace settings.json
	skipSetup: z.boolean().default(false), // Skip interactive configuration wizard
	refresh: z.boolean().default(false), // Bypass release cache to fetch latest versions
	docsDir: z.string().optional(), // Custom docs folder name
	plansDir: z.string().optional(), // Custom plans folder name
	yes: z.boolean().default(false), // Non-interactive mode with sensible defaults
});
export type UpdateCommandOptions = z.infer<typeof UpdateCommandOptionsSchema>;

export const VersionCommandOptionsSchema = z.object({
	kit: KitType.optional(),
	limit: z.number().optional(),
	all: z.boolean().optional(),
});
export type VersionCommandOptions = z.infer<typeof VersionCommandOptionsSchema>;

export const UninstallCommandOptionsSchema = z.object({
	yes: z.boolean().default(false),
	local: z.boolean().default(false),
	global: z.boolean().default(false),
	all: z.boolean().default(false),
	dryRun: z.boolean().default(false), // Preview without deleting
	forceOverwrite: z.boolean().default(false), // Delete even modified files
});
export type UninstallCommandOptions = z.infer<typeof UninstallCommandOptionsSchema>;

// CLI update command options (for updating the CLI package itself)
export const UpdateCliOptionsSchema = z.object({
	release: z.string().optional(), // Specific version to update to (using 'release' to avoid conflict with global --version flag)
	check: z.boolean().default(false), // Check only, don't install
	yes: z.boolean().default(false), // Skip confirmation prompt
	beta: z.boolean().default(false), // Update to beta version
	registry: z.string().url().optional(), // Custom npm registry URL
});
export type UpdateCliOptions = z.infer<typeof UpdateCliOptionsSchema>;

// Backward compatibility alias
export type InitCommandOptions = UpdateCommandOptions;
