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
	skipSetup: z.boolean().default(false), // Skip interactive configuration wizard
	refresh: z.boolean().default(false), // Bypass release cache to fetch latest versions
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

// Security-sensitive files that should NEVER be copied from templates
// These files may contain secrets, keys, or credentials and must never overwrite user's versions
export const NEVER_COPY_PATTERNS = [
	// Environment and secrets
	".env",
	".env.local",
	".env.*.local",
	"*.key",
	"*.pem",
	"*.p12",
	// Dependencies and build artifacts
	"node_modules/**",
	".git/**",
	"dist/**",
	"build/**",
];

// User configuration files that should only be skipped if they already exist
// On first installation, these should be copied; on updates, preserve user's version
export const USER_CONFIG_PATTERNS = [
	".gitignore",
	".repomixignore",
	".mcp.json",
	".ckignore",
	"CLAUDE.md",
];

// Combined protected patterns for backward compatibility
export const PROTECTED_PATTERNS = [...NEVER_COPY_PATTERNS, ...USER_CONFIG_PATTERNS];

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

export class SkillsMigrationError extends ClaudeKitError {
	constructor(message: string) {
		super(message, "SKILLS_MIGRATION_ERROR");
		this.name = "SkillsMigrationError";
	}
}

// Enhanced release types for version selection
export interface EnrichedRelease extends GitHubRelease {
	displayVersion: string;
	normalizedVersion: string;
	relativeTime: string;
	isLatestStable: boolean;
	isLatestBeta: boolean;
	assetCount: number;
}

// Release filtering options
export interface FilterOptions {
	includeDrafts?: boolean;
	includePrereleases?: boolean;
	limit?: number;
	sortBy?: "date" | "version";
	order?: "asc" | "desc";
}

// Cache entry for release lists
export interface CacheEntry {
	timestamp: number;
	releases: GitHubRelease[];
}
