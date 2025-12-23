/**
 * Init command types and context interface
 */

import type { PromptsManager } from "@/domains/ui/prompts.js";
import type {
	FoldersConfig,
	GitHubRelease,
	KitConfig,
	KitType,
	UpdateCommandOptions,
} from "@/types";

/**
 * Validated options after Zod parsing
 */
export interface ValidatedOptions {
	kit?: string;
	dir: string;
	release?: string;
	folder?: string;
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
	skipSetup: boolean;
	forceOverwrite: boolean;
	forceOverwriteSettings: boolean;
	dryRun: boolean;
	prefix: boolean;
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

	/** Local folder mode (--folder flag) */
	isLocalFolder: boolean;

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
}

/**
 * Phase handler function signature
 * Each phase receives context and returns modified context
 */
export type PhaseHandler = (ctx: InitContext) => Promise<InitContext>;
