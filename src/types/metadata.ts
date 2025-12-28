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
});

// Per-kit metadata (used in multi-kit structure)
export const KitMetadataSchema = z.object({
	version: z.string(),
	installedAt: z.string(),
	// Enhanced file ownership tracking (pip RECORD pattern)
	files: z.array(TrackedFileSchema).optional(),
	// Sync feature fields
	lastUpdateCheck: z.string().optional(), // ISO timestamp of last update check
	dismissedVersion: z.string().optional(), // Version user dismissed (don't nag)
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
	workflows: number;
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
