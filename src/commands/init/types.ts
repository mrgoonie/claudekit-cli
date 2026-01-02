/**
 * Init command types and context interface
 */

import type { PromptsManager } from "@/domains/ui/prompts.js";
import type {
	FoldersConfig,
	GitHubRelease,
	KitConfig,
	KitType,
	TrackedFile,
	UpdateCommandOptions,
} from "@/types";

/**
 * Validated options after Zod parsing
 */
export interface ValidatedOptions {
	kit?: string;
	dir: string;
	release?: string;
	beta: boolean;
	global: boolean;
	yes: boolean;
	fresh: boolean;
	refresh: boolean;
	exclude: string[];
	only: string[];
	docsDir?: string;
	plansDir?: string;
	installSkills: boolean;
	withSudo: boolean;
	skipSetup: boolean;
	forceOverwrite: boolean;
	forceOverwriteSettings: boolean;
	dryRun: boolean;
	prefix: boolean;
	sync: boolean;
	useGit: boolean;
	archive?: string;
	kitPath?: string;
}

/**
 * Context object passed through all init phases
 * Each phase receives and returns this context
 */
export interface InitContext {
	/** Raw CLI options */
	rawOptions: UpdateCommandOptions;

	/** Validated options after schema parsing */
	options: ValidatedOptions;

	/** Prompts manager for UI interactions */
	prompts: PromptsManager;

	/** Whether explicit --dir flag was provided */
	explicitDir: boolean;

	/** Non-interactive mode detection */
	isNonInteractive: boolean;

	/** Selected kit configuration */
	kit?: KitConfig;

	/** Kit type key (e.g., "engineer") */
	kitType?: KitType;

	/** Resolved target directory (absolute path) */
	resolvedDir?: string;

	/** Selected GitHub release */
	release?: GitHubRelease;

	/** Selected version tag */
	selectedVersion?: string;

	/** Temporary directory for download */
	tempDir?: string;

	/** Path to downloaded archive */
	archivePath?: string;

	/** Extraction directory */
	extractDir?: string;

	/** Claude directory path (.claude or global kit dir) */
	claudeDir?: string;

	/** Folders configuration (docs/plans dirs) */
	foldersConfig?: FoldersConfig;

	/** Custom .claude files to preserve */
	customClaudeFiles: string[];

	/** Include patterns for selective update */
	includePatterns: string[];

	/** Whether to install skills */
	installSkills: boolean;

	/** Whether cancelled by user */
	cancelled: boolean;

	/** Additional kits to install after current one (multi-kit mode) */
	pendingKits?: KitType[];

	/** All kits accessible to the user (from access check) */
	accessibleKits?: KitType[];
}

/**
 * Extended context for sync operations
 * Uses discriminated union pattern with literal type for type safety
 */
export interface SyncContext extends InitContext {
	/** Discriminator - always true when sync is in progress */
	syncInProgress: true;
	/** Files tracked in metadata for sync */
	syncTrackedFiles: TrackedFile[];
	/** Current installed version */
	syncCurrentVersion: string;
	/** Latest available version */
	syncLatestVersion: string;
}

/**
 * Type guard for sync context
 * Uses discriminated union pattern for proper TypeScript narrowing
 */
export function isSyncContext(ctx: InitContext): ctx is SyncContext {
	return (
		"syncInProgress" in ctx &&
		ctx.syncInProgress === true &&
		"syncTrackedFiles" in ctx &&
		Array.isArray(ctx.syncTrackedFiles)
	);
}

/**
 * Phase handler function signature
 * Each phase receives context and returns modified context
 */
export type PhaseHandler = (ctx: InitContext) => Promise<InitContext>;
