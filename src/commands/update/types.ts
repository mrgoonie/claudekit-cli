/**
 * Shared types for the update pipeline modules.
 */

import type { NpmRegistryClient } from "@/domains/github/npm-registry.js";
import type { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import type { KitType } from "@/types";
import type { UpdatePipelineConfig } from "@/types/ck-config.js";

// ─── Utility types shared across update pipeline ─────────────────────────────

export type ExecAsyncResult = { stdout?: string; stderr?: string } | string;
export type ExecAsyncFn = (
	command: string,
	options?: { timeout?: number },
) => Promise<ExecAsyncResult>;

export type UpdateCliPackageManagerDetector = Pick<
	typeof PackageManagerDetector,
	"detect" | "getVersion" | "getDisplayName" | "getNpmRegistryUrl" | "getUpdateCommand"
>;

export type UpdateCliNpmRegistryClient = Pick<
	typeof NpmRegistryClient,
	"versionExists" | "getDevVersion" | "getLatestVersion"
>;

// ─── Kit selection types ──────────────────────────────────────────────────────

/** Kit selection parameters for determining which kit to update */
export interface KitSelectionParams {
	hasLocal: boolean;
	hasGlobal: boolean;
	localKits: KitType[];
	globalKits: KitType[];
}

/** Kit selection result with init command configuration */
export interface KitSelectionResult {
	isGlobal: boolean;
	kit: KitType | undefined;
	promptMessage: string;
}

// ─── Setup shape used by promptKitUpdate and promptMigrateUpdate ──────────────

export type PromptKitUpdateSetup = {
	global: {
		path: string;
		metadata: { kits?: Record<string, { version?: string }> } | null;
		components: {
			commands: number;
			hooks: number;
			skills: number;
			workflows: number;
			settings: number;
		};
	};
	project: {
		path: string;
		metadata: { kits?: Record<string, { version?: string }> } | null;
		components: {
			commands: number;
			hooks: number;
			skills: number;
			workflows: number;
			settings: number;
		};
	};
};

export type PromptKitUpdateConfigLoader = (
	projectDir: string | null,
) => Promise<{ config: { updatePipeline?: Partial<UpdatePipelineConfig> } }>;

export type PromptKitUpdateConfirmFn = (opts: { message: string }) => Promise<boolean | symbol>;
export type PromptKitUpdateCancelFn = (value: unknown) => boolean;
export type PromptKitUpdateSpinner = {
	start: (msg?: string) => void;
	stop: (msg?: string, code?: number) => void;
	message: (msg?: string) => void;
};
