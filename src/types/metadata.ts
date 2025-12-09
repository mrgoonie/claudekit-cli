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
}

export const TrackedFileSchema = z.object({
	path: z.string(),
	checksum: z.string().regex(/^[a-f0-9]{64}$/, "Invalid SHA-256 checksum"),
	ownership: z.enum(["ck", "user", "ck-modified"]),
	installedVersion: z.string(),
});

// Metadata schema (for .claude/metadata.json)
export const MetadataSchema = z.object({
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
export type Metadata = z.infer<typeof MetadataSchema>;

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
