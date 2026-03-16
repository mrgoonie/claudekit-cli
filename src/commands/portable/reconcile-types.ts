/**
 * Type definitions for reconciler module
 * Pure types for idempotent migration planning
 */
import type { PortableManifest } from "./portable-manifest.js";
import type { PortableRegistryV3 } from "./portable-registry.js";

export const UNKNOWN_CHECKSUM = "unknown" as const;

/**
 * Normalize checksum values to a stable sentinel for missing/unknown states.
 */
export function normalizeChecksum(checksum: string | undefined | null): string {
	if (!checksum) return UNKNOWN_CHECKSUM;
	const trimmed = checksum.trim();
	if (!trimmed) return UNKNOWN_CHECKSUM;
	if (trimmed.toLowerCase() === UNKNOWN_CHECKSUM) return UNKNOWN_CHECKSUM;
	return trimmed;
}

export function isUnknownChecksum(checksum: string | undefined | null): boolean {
	return normalizeChecksum(checksum) === UNKNOWN_CHECKSUM;
}

/** Action types the reconciler can determine */
export type ReconcileActionType = "install" | "update" | "skip" | "conflict" | "delete";

/** A single action to take for one (item, provider) combination */
export interface ReconcileAction {
	action: ReconcileActionType;
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	provider: string;
	global: boolean;
	targetPath: string;
	reason: string;

	// Checksum context (for reporting/debugging)
	sourceChecksum?: string;
	registeredSourceChecksum?: string;
	currentTargetChecksum?: string;
	registeredTargetChecksum?: string;

	// For renames/path migrations
	previousItem?: string; // Old item name (rename)
	previousPath?: string; // Old target path (path migration)
	cleanupPaths?: string[]; // Paths to delete during execution

	// For merge targets
	ownedSections?: string[]; // Sections CK manages in this file
	affectedSections?: string[]; // Sections that changed

	// For conflicts
	diff?: string; // Human-readable diff
	resolution?: ConflictResolution; // Set by user
}

/** How a conflict should be resolved */
export type ConflictResolution =
	| { type: "overwrite" } // Use CK version
	| { type: "keep" } // Keep user version
	| { type: "smart-merge" } // Update CK sections, keep user additions
	| { type: "resolved"; content: string }; // User-provided content

/**
 * Source item state with checksums pre-computed
 * Conversion is provider-specific (YAML for Roo, JSON for Cline, etc.)
 */
export interface SourceItemState {
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	sourceChecksum: string; // SHA-256 of current source content
	// Per-provider converted checksums (each provider has different format)
	convertedChecksums: Record<string, string>; // provider → SHA-256 of converted content
}

/** Target file state (what exists on disk right now) */
export interface TargetFileState {
	path: string;
	exists: boolean;
	currentChecksum?: string; // SHA-256 of what's on disk right now
}

/** Stripped-down provider config for reconciler (no I/O methods) */
export interface ReconcileProviderInput {
	provider: string; // Provider name
	global: boolean; // Global vs project-level install
}

/** Input to reconcile function */
export interface ReconcileInput {
	sourceItems: SourceItemState[];
	registry: PortableRegistryV3; // Current registry state
	targetStates: Map<string, TargetFileState>; // path → current disk state
	manifest?: PortableManifest | null; // From portable-manifest.json (Phase 4)
	providerConfigs: ReconcileProviderInput[]; // Provider metadata only, no I/O
	force?: boolean; // Override skip decisions for deleted/edited targets
}

/** Output plan from reconcile function */
export interface ReconcilePlan {
	actions: ReconcileAction[];
	summary: {
		install: number;
		update: number;
		skip: number;
		conflict: number;
		delete: number;
	};
	hasConflicts: boolean;
}
