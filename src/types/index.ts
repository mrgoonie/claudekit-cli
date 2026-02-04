/**
 * Central type exports - re-exports all types from domain files
 */

// Kit types
export {
	KitType,
	KitConfigSchema,
	type KitConfig,
	AVAILABLE_KITS,
	NEVER_COPY_PATTERNS,
	USER_CONFIG_PATTERNS,
	PROTECTED_PATTERNS,
	isValidKitType,
} from "./kit.js";

// Command types
export {
	ExcludePatternSchema,
	FoldersConfigSchema,
	type FoldersConfig,
	DEFAULT_FOLDERS,
	NewCommandOptionsSchema,
	type NewCommandOptions,
	UpdateCommandOptionsSchema,
	type UpdateCommandOptions,
	VersionCommandOptionsSchema,
	type VersionCommandOptions,
	UninstallCommandOptionsSchema,
	type UninstallCommandOptions,
	UpdateCliOptionsSchema,
	type UpdateCliOptions,
	type InitCommandOptions,
} from "./commands.js";

// GitHub types
export {
	GitHubReleaseAssetSchema,
	type GitHubReleaseAsset,
	GitHubReleaseSchema,
	type GitHubRelease,
	type EnrichedRelease,
	type FilterOptions,
	type CacheEntry,
} from "./github.js";

// Metadata types
export {
	type FileOwnership,
	type TrackedFile,
	TrackedFileSchema,
	InstalledSettingsSchema,
	type InstalledSettings,
	KitMetadataSchema,
	type KitMetadata,
	MultiKitMetadataSchema,
	type MultiKitMetadata,
	LegacyMetadataSchema,
	type LegacyMetadata,
	MetadataSchema,
	type Metadata,
	ConfigSchema,
	type Config,
	type ComponentCounts,
	type ClaudeKitMetadata,
	type ClaudeKitSetupInfo,
	type ClaudeKitSetup,
} from "./metadata.js";

// Skills types
export {
	SkillsManifestSchema,
	type SkillsManifest,
	type MigrationStatus,
	type MigrationDetectionResult,
	type CustomizationDetection,
	type FileChange,
	type SkillMapping,
	type MigrationOptions,
	type MigrationResult,
	type MigrationError,
} from "./skills.js";

// Error types
export {
	ClaudeKitError,
	AuthenticationError,
	GitHubError,
	DownloadError,
	ExtractionError,
	SkillsMigrationError,
} from "./errors.js";

// Common types
export type {
	ArchiveType,
	DownloadProgress,
	AuthMethod,
	DependencyName,
	DependencyStatus,
	DependencyConfig,
	InstallationMethod,
	InstallResult,
} from "./common.js";

// ClaudeKit data types
export {
	RegisteredProjectSchema,
	type RegisteredProject,
	ProjectsRegistrySchema,
	type ProjectsRegistry,
	DEFAULT_PROJECTS_REGISTRY,
} from "./claudekit-data.js";

// CkConfig types (.ck.json schema)
export {
	// Enums and primitives
	PlanValidationModeSchema,
	type PlanValidationMode,
	PlanFocusAreaSchema,
	type PlanFocusArea,
	PlanResolutionOrderSchema,
	type PlanResolutionOrder,
	ProjectTypeSchema,
	type ProjectType,
	PackageManagerSchema,
	type PackageManager,
	FrameworkSchema,
	type Framework,
	GeminiModelSchema,
	type GeminiModel,
	StatuslineModeSchema,
	type StatuslineMode,
	CodingLevelSchema,
	type CodingLevel,
	// Nested config schemas
	PlanResolutionSchema,
	type PlanResolution,
	PlanValidationSchema,
	type PlanValidation,
	CkPlanConfigSchema,
	type CkPlanConfig,
	CkDocsConfigSchema,
	type CkDocsConfig,
	CkPathsConfigSchema,
	type CkPathsConfig,
	CkLocaleConfigSchema,
	type CkLocaleConfig,
	CkTrustConfigSchema,
	type CkTrustConfig,
	CkProjectConfigSchema,
	type CkProjectConfig,
	CkGeminiConfigSchema,
	type CkGeminiConfig,
	CkSkillsConfigSchema,
	type CkSkillsConfig,
	CkAssertionSchema,
	type CkAssertion,
	CkHooksConfigSchema,
	type CkHooksConfig,
	// Main config
	CkConfigSchema,
	type CkConfig,
	type CkConfigWithSources,
	type ConfigSource,
	DEFAULT_CK_CONFIG,
	CK_HOOK_NAMES,
	type CkHookName,
} from "./ck-config.js";
