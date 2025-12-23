/**
 * New command types and context interface
 */

import type { PromptsManager } from "@/domains/ui/prompts.js";
import type { KitType, NewCommandOptions } from "@/types";

/**
 * Result from directory setup phase
 */
export interface DirectorySetupResult {
	kit: KitType;
	resolvedDir: string;
	isNonInteractive: boolean;
}

/**
 * Result from project creation phase
 */
export interface ProjectCreationResult {
	releaseTag: string;
	installedFiles: string[];
	claudeDir: string;
}

/**
 * Context for new command (future use when adopting context pattern)
 */
export interface NewContext {
	options: NewCommandOptions;
	prompts: PromptsManager;
	isNonInteractive: boolean;

	// Phase results
	kit?: KitType;
	resolvedDir?: string;
	releaseTag?: string;
	installedFiles?: string[];
	claudeDir?: string;

	cancelled: boolean;
}

/**
 * Phase handler function signature (for future context pattern)
 */
export type NewPhaseHandler = (ctx: NewContext) => Promise<NewContext>;
