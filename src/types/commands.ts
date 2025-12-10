/**
 * Command options schemas and types
 */
import { z } from "zod";
import { KitType } from "./kit.js";

/**
 * Global output options schema for verbosity control
 * These options are available on all commands
 */
export const GlobalOutputOptionsSchema = z.object({
	verbose: z.boolean().default(false), // Full output including subprocess logs
	json: z.boolean().default(false), // Machine-readable JSON output
});
export type GlobalOutputOptions = z.infer<typeof GlobalOutputOptionsSchema>;

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
export const NewCommandOptionsSchema = z
	.object({
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
		yes: z.boolean().default(false), // Non-interactive mode
	})
	.merge(GlobalOutputOptionsSchema);
export type NewCommandOptions = z.infer<typeof NewCommandOptionsSchema>;

export const UpdateCommandOptionsSchema = z
	.object({
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
	})
	.merge(GlobalOutputOptionsSchema);
export type UpdateCommandOptions = z.infer<typeof UpdateCommandOptionsSchema>;

export const VersionCommandOptionsSchema = z
	.object({
		kit: KitType.optional(),
		limit: z.number().optional(),
		all: z.boolean().optional(),
	})
	.merge(GlobalOutputOptionsSchema);
export type VersionCommandOptions = z.infer<typeof VersionCommandOptionsSchema>;

export const UninstallCommandOptionsSchema = z
	.object({
		yes: z.boolean().default(false),
		local: z.boolean().default(false),
		global: z.boolean().default(false),
		all: z.boolean().default(false),
		dryRun: z.boolean().default(false), // Preview without deleting
		forceOverwrite: z.boolean().default(false), // Delete even modified files
	})
	.merge(GlobalOutputOptionsSchema);
export type UninstallCommandOptions = z.infer<typeof UninstallCommandOptionsSchema>;

// CLI update command options (for updating the CLI package itself)
export const UpdateCliOptionsSchema = z
	.object({
		release: z.string().optional(), // Specific version to update to (using 'release' to avoid conflict with global --version flag)
		check: z.boolean().default(false), // Check only, don't install
		yes: z.boolean().default(false), // Skip confirmation prompt
		beta: z.boolean().default(false), // Update to beta version
		registry: z.string().url().optional(), // Custom npm registry URL
	})
	.merge(GlobalOutputOptionsSchema);
export type UpdateCliOptions = z.infer<typeof UpdateCliOptionsSchema>;

// Doctor command options
export const DoctorCommandOptionsSchema = z
	.object({
		report: z.boolean().default(false), // Generate shareable diagnostic report
		fix: z.boolean().default(false), // Auto-fix fixable issues
		checkOnly: z.boolean().default(false), // CI mode: no prompts, exit 1 on failures
		full: z.boolean().default(false), // Run full checks including slow ones
	})
	.merge(GlobalOutputOptionsSchema);
export type DoctorCommandOptions = z.infer<typeof DoctorCommandOptionsSchema>;

// Backward compatibility alias
export type InitCommandOptions = UpdateCommandOptions;
