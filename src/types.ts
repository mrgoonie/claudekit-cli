import { z } from "zod";

// Kit types
export const KitType = z.enum(["engineer", "marketing"]);
export type KitType = z.infer<typeof KitType>;

// Exclude pattern validation schema
export const ExcludePatternSchema = z
	.string()
	.trim()
	.min(1, "Exclude pattern cannot be empty")
	.max(500, "Exclude pattern too long")
	.refine((val) => !val.startsWith("/"), "Absolute paths not allowed in exclude patterns")
	.refine((val) => !val.includes(".."), "Path traversal not allowed in exclude patterns");

// Command options schemas
export const NewCommandOptionsSchema = z.object({
	dir: z.string().default("."),
	kit: KitType.optional(),
	version: z.string().optional(),
	force: z.boolean().default(false),
	exclude: z.array(ExcludePatternSchema).optional().default([]),
	opencode: z.boolean().default(false),
	gemini: z.boolean().default(false),
});
export type NewCommandOptions = z.infer<typeof NewCommandOptionsSchema>;

export const UpdateCommandOptionsSchema = z.object({
	dir: z.string().default("."),
	kit: KitType.optional(),
	version: z.string().optional(),
	exclude: z.array(ExcludePatternSchema).optional().default([]),
	only: z.array(ExcludePatternSchema).optional().default([]),
});
export type UpdateCommandOptions = z.infer<typeof UpdateCommandOptionsSchema>;

export const VersionCommandOptionsSchema = z.object({
	kit: KitType.optional(),
	limit: z.number().optional(),
	all: z.boolean().optional(),
});
export type VersionCommandOptions = z.infer<typeof VersionCommandOptionsSchema>;

// Metadata schema (for .claude/metadata.json)
export const MetadataSchema = z.object({
	name: z.string().optional(),
	version: z.string().optional(),
});
export type Metadata = z.infer<typeof MetadataSchema>;

// Config schemas
export const ConfigSchema = z.object({
	github: z
		.object({
			token: z.string().optional(),
		})
		.optional(),
	defaults: z
		.object({
			kit: KitType.optional(),
			dir: z.string().optional(),
		})
		.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

// GitHub schemas
export const GitHubReleaseAssetSchema = z.object({
	id: z.number(),
	name: z.string(),
	url: z.string().url(), // API endpoint for authenticated downloads
	browser_download_url: z.string().url(), // Direct download URL (public only)
	size: z.number(),
	content_type: z.string(),
});
export type GitHubReleaseAsset = z.infer<typeof GitHubReleaseAssetSchema>;

export const GitHubReleaseSchema = z.object({
	id: z.number(),
	tag_name: z.string(),
	name: z.string(),
	draft: z.boolean(),
	prerelease: z.boolean(),
	assets: z.array(GitHubReleaseAssetSchema),
	published_at: z.string().optional(),
	tarball_url: z.string().url(),
	zipball_url: z.string().url(),
});
export type GitHubRelease = z.infer<typeof GitHubReleaseSchema>;

// Kit configuration
export const KitConfigSchema = z.object({
	name: z.string(),
	repo: z.string(),
	owner: z.string(),
	description: z.string(),
});
export type KitConfig = z.infer<typeof KitConfigSchema>;

// Available kits
export const AVAILABLE_KITS: Record<KitType, KitConfig> = {
	engineer: {
		name: "ClaudeKit Engineer",
		repo: "claudekit-engineer",
		owner: "claudekit",
		description: "Engineering toolkit for building with Claude",
	},
	marketing: {
		name: "ClaudeKit Marketing",
		repo: "claudekit-marketing",
		owner: "claudekit",
		description: "[Coming Soon] Marketing toolkit",
	},
};

// Protected file patterns (files to skip during update)
export const PROTECTED_PATTERNS = [
	// Environment and secrets
	".env",
	".env.local",
	".env.*.local",
	"*.key",
	"*.pem",
	"*.p12",
	// User configuration files (only skip if they exist)
	".gitignore",
	".repomixignore",
	".mcp.json",
	"CLAUDE.md",
	// Dependencies and build artifacts
	"node_modules/**",
	".git/**",
	"dist/**",
	"build/**",
];

// Archive types
export type ArchiveType = "tar.gz" | "zip";

// Download progress
export interface DownloadProgress {
	total: number;
	current: number;
	percentage: number;
}

// Authentication method
export type AuthMethod = "gh-cli" | "env-var" | "keychain" | "prompt";

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

// Error types
export class ClaudeKitError extends Error {
	constructor(
		message: string,
		public code?: string,
		public statusCode?: number,
	) {
		super(message);
		this.name = "ClaudeKitError";
	}
}

export class AuthenticationError extends ClaudeKitError {
	constructor(message: string) {
		super(message, "AUTH_ERROR", 401);
		this.name = "AuthenticationError";
	}
}

export class GitHubError extends ClaudeKitError {
	constructor(message: string, statusCode?: number) {
		super(message, "GITHUB_ERROR", statusCode);
		this.name = "GitHubError";
	}
}

export class DownloadError extends ClaudeKitError {
	constructor(message: string) {
		super(message, "DOWNLOAD_ERROR");
		this.name = "DownloadError";
	}
}

export class ExtractionError extends ClaudeKitError {
	constructor(message: string) {
		super(message, "EXTRACTION_ERROR");
		this.name = "ExtractionError";
	}
}

// Dependency management types
export type DependencyName = "claude" | "python" | "nodejs" | "pip" | "npm";

export interface DependencyStatus {
	name: string;
	installed: boolean;
	version?: string;
	path?: string;
	minVersion?: string;
	meetsRequirements: boolean;
	message?: string;
}

export interface DependencyConfig {
	name: DependencyName;
	commands: string[];
	versionFlag: string;
	versionRegex: RegExp;
	minVersion?: string;
	required: boolean;
}

export interface InstallationMethod {
	name: string;
	command: string;
	requiresSudo: boolean;
	platform: "darwin" | "linux" | "win32";
	priority: number;
	description?: string;
}

export interface InstallResult {
	success: boolean;
	message: string;
	installedVersion?: string;
}
