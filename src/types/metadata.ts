/**
 * Metadata and config schemas
 */
import { z } from "zod";
import { FoldersConfigSchema } from "./commands.js";
import { KitType } from "./kit.js";

// File ownership tracking types
export type FileOwnership = "ck" | "user" | "ck-modified";

export interface TrackedFile {
	path: string; // Relative to .claude directory
	checksum: string; // SHA-256 hash (hex format)
	ownership: FileOwnership; // Ownership classification
	installedVersion: string; // CK version that installed it
	baseChecksum?: string; // Original checksum at install (for sync detection)
	sourceTimestamp?: string; // Git commit timestamp from kit repo (ISO 8601)
	installedAt?: string; // When file was installed locally (ISO 8601)
}

export const TrackedFileSchema = z.object({
	path: z.string(),
	checksum: z.string().regex(/^[a-f0-9]{64}$/, "Invalid SHA-256 checksum"),
	ownership: z.enum(["ck", "user", "ck-modified"]),
	installedVersion: z.string(),
	baseChecksum: z
		.string()
		.regex(/^[a-f0-9]{64}$/, "Invalid SHA-256 checksum")
		.optional(),
	sourceTimestamp: z.string().datetime({ offset: true }).optional(),
	installedAt: z.string().datetime({ offset: true }).optional(),
});

// Track what settings CK has installed (for respecting user deletions)
export const InstalledSettingsSchema = z.object({
	// Hook commands that CK installed (by command string)
	hooks: z.array(z.string()).optional(),
	// MCP server names that CK installed
	mcpServers: z.array(z.string()).optional(),
	// Timestamp tracking for conflict resolution (command/serverName -> ISO timestamp)
	hookTimestamps: z.record(z.string()).optional(),
	mcpServerTimestamps: z.record(z.string()).optional(),
});
export type InstalledSettings = z.infer<typeof InstalledSettingsSchema>;

// Per-kit metadata (used in multi-kit structure)
export const KitMetadataSchema = z.object({
	version: z.string(),
	installedAt: z.string(),
	// Enhanced file ownership tracking (pip RECORD pattern)
	files: z.array(TrackedFileSchema).optional(),
	// Sync feature fields
	lastUpdateCheck: z.string().optional(), // ISO timestamp of last update check
	dismissedVersion: z.string().optional(), // Version user dismissed (don't nag)
	// Track installed settings to respect user deletions
	installedSettings: InstalledSettingsSchema.optional(),
	// Plugin installation tracking (CC >= 1.0.33)
	pluginInstalled: z.boolean().optional(), // Whether plugin was successfully verified
	pluginInstalledAt: z.string().optional(), // ISO timestamp of last plugin install
	pluginVersion: z.string().optional(), // Kit version at time of plugin install
});
export type KitMetadata = z.infer<typeof KitMetadataSchema>;

// Multi-kit metadata structure (new format)
// Discriminator: presence of `kits` object with at least one entry indicates multi-kit format
// Absence of `kits` or empty `kits` with `name`/`version` at root indicates legacy format
export const MultiKitMetadataSchema = z.object({
	// Multi-kit discriminator: non-empty kits object indicates multi-kit format
	kits: z.record(KitType, KitMetadataSchema).optional(),
	scope: z.enum(["local", "global"]).optional(),
	// Legacy fields preserved for backward compat (ignored when kits is present)
	name: z.string().optional(),
	version: z.string().optional(),
	installedAt: z.string().optional(),
	installedFiles: z.array(z.string()).optional(), // DEPRECATED - use kits[kit].files
	userConfigFiles: z.array(z.string()).optional(), // DEPRECATED
	files: z.array(TrackedFileSchema).optional(), // Legacy single-kit files, use kits[kit].files
});
export type MultiKitMetadata = z.infer<typeof MultiKitMetadataSchema>;

// Legacy single-kit metadata schema (for backward compat)
export const LegacyMetadataSchema = z.object({
	name: z.string().optional(),
	version: z.string().optional(),
	installedAt: z.string().optional(),
	scope: z.enum(["local", "global"]).optional(),
	// Files/directories installed by ClaudeKit (relative paths)
	installedFiles: z.array(z.string()).optional(), // DEPRECATED - keep for backward compat
	// User config files that should be preserved during uninstall
	userConfigFiles: z.array(z.string()).optional(), // DEPRECATED
	// Enhanced file ownership tracking (pip RECORD pattern)
	files: z.array(TrackedFileSchema).optional(),
});
export type LegacyMetadata = z.infer<typeof LegacyMetadataSchema>;

// Metadata schema - union of legacy and multi-kit formats
// Kept as alias for backward compatibility with existing code
export const MetadataSchema = MultiKitMetadataSchema;
export type Metadata = z.infer<typeof MetadataSchema>;

// Download method preference
export const DownloadMethodSchema = z.enum(["auto", "git", "api"]);

// Config schemas
export const ConfigSchema = z.object({
	defaults: z
		.object({
			kit: KitType.optional(),
			dir: z.string().optional(),
			terminalApp: z.string().optional(),
			editorApp: z.string().optional(),
		})
		.optional(),
	// Custom folder names configuration (persistent)
	folders: FoldersConfigSchema.optional(),
	// Preferred download method (git clone vs API)
	downloadMethod: DownloadMethodSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

// ClaudeKit setup types
export interface ComponentCounts {
	agents: number;
	commands: number;
	rules: number;
	skills: number;
}

export interface ClaudeKitMetadata {
	version: string;
	name: string;
	description: string;
	buildDate?: string;
	repository?: {
		type: string;
		url: string;
	};
	download?: {
		lastDownloadedAt: string | null;
		downloadedBy: string | null;
		installCount: number;
	};
	/**
	 * Paths to delete from user's .claude/ directory during install.
	 * Used for cleaning up archived/deprecated commands and files.
	 * Paths are relative to .claude/ directory (e.g., "commands/old.md").
	 */
	deletions?: string[];
}

export interface ClaudeKitSetupInfo {
	path: string;
	metadata: ClaudeKitMetadata | null;
	components: ComponentCounts;
}

export interface ClaudeKitSetup {
	global: ClaudeKitSetupInfo;
	project: ClaudeKitSetupInfo;
}
