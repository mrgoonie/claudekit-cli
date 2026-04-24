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

/**
 * Structured reason codes for reconcile decisions.
 * Shared between CLI output and dashboard UI.
 * Translations added in later phases — EN copy lives in getReasonCopy().
 */
export type ReconcileReason =
	// install bucket
	| "new-item" // Not in registry, never installed
	| "new-provider-for-item" // Item exists for other providers, new for this one
	| "target-deleted-source-changed" // File deleted, CK has updates
	| "target-dir-empty-reinstall" // Whole type dir missing/empty (empty-dir override)
	| "force-reinstall" // --force on deleted target
	| "force-overwrite" // --force on user-edited target (overwrites your edits)
	| "registry-upgrade-reinstall" // v2→v3 migration, target missing
	// update bucket
	| "source-changed" // CK updated, no user edits
	| "registry-upgrade-heal" // v2→v3 migration, target stale
	// skip bucket
	| "no-changes"
	| "user-edits-preserved" // Target edited, source unchanged
	| "user-deleted-respected" // Target deleted + source unchanged + not in empty-dir scope
	| "target-up-to-date-backfill" // Checksum drift but output matches
	| "provider-checksum-unavailable"
	| "target-state-unknown"
	// delete bucket
	| "source-removed-orphan" // Registry has it, CK source no longer does
	| "renamed-cleanup" // From manifest rename
	| "path-migrated-cleanup" // From manifest path migration
	// conflict bucket
	| "both-changed"
	| "target-state-unknown-source-changed";

/**
 * Human-readable EN copy for each reason code.
 * Context param is reserved for future interpolation (e.g. provider name, path).
 * Translations live here — extend per-locale in a later phase.
 */
export function getReasonCopy(code: ReconcileReason, _ctx?: Record<string, string>): string {
	switch (code) {
		case "new-item":
			return "New — not previously installed";
		case "new-provider-for-item":
			return "New provider for existing item";
		case "target-deleted-source-changed":
			return "You deleted this, CK has updates — reinstalling";
		case "target-dir-empty-reinstall":
			return "Provider directory is empty — reinstalling";
		case "force-reinstall":
			return "Force reinstall (target was deleted)";
		case "force-overwrite":
			return "Force overwrite (you edited this, --force active)";
		case "registry-upgrade-reinstall":
			return "Target deleted — reinstalling after registry upgrade";
		case "source-changed":
			return "CK updated, you didn't edit — safe to overwrite";
		case "registry-upgrade-heal":
			return "Healing stale target after registry upgrade";
		case "no-changes":
			return "Already up to date";
		case "user-edits-preserved":
			return "You edited this, CK unchanged — keeping your edits";
		case "user-deleted-respected":
			return "You deleted this, CK unchanged — respecting your choice";
		case "target-up-to-date-backfill":
			return "Already up to date — registry checksums will be backfilled";
		case "provider-checksum-unavailable":
			return "Provider checksum unavailable — cannot verify safely";
		case "target-state-unknown":
			return "Target state unavailable, CK unchanged — preserving target";
		case "source-removed-orphan":
			return "No longer shipped by CK — will be removed";
		case "renamed-cleanup":
			return "Renamed — cleaning up old path";
		case "path-migrated-cleanup":
			return "Path migrated — cleaning up old location";
		case "both-changed":
			return "Both you and CK changed this — pick one";
		case "target-state-unknown-source-changed":
			return "Target state unavailable while CK changed — manual review required";
	}
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

	// Structured reason code + copy (additive — old `reason` string preserved for back-compat)
	reasonCode?: ReconcileReason;
	reasonCopy?: string;

	// True for skill type, used by install picker (directory-based install)
	isDirectoryItem?: boolean;

	// Checksum context (for reporting/debugging)
	sourceChecksum?: string;
	registeredSourceChecksum?: string;
	currentTargetChecksum?: string;
	registeredTargetChecksum?: string;
	backfillRegistry?: boolean;

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
	// Per-provider target checksums for strategies where one item maps to one managed target blob
	targetChecksums?: Record<string, string>; // provider → SHA-256 of installed target content
}

/** Target file state (what exists on disk right now) */
export interface TargetFileState {
	path: string;
	exists: boolean;
	currentChecksum?: string; // SHA-256 of what's on disk right now
	sectionChecksums?: Record<string, string>; // For merge-single targets: managed section → checksum
}

/**
 * State of a provider's type directory (e.g. ~/.claude/skills/).
 * Computed by callers (reconcile-state-builders) and passed into reconciler input.
 * The reconciler stays pure — no FS I/O here.
 */
export interface TargetDirectoryState {
	provider: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	global: boolean;
	/** Resolved absolute path to the provider's type directory */
	path: string;
	exists: boolean;
	/** True when dir is missing OR present-but-empty (after filtering to CK-managed extensions) */
	isEmpty: boolean;
	fileCount: number;
}

/**
 * A banner emitted by the reconciler to inform UI/CLI of notable batch decisions.
 * Always returned in ReconcilePlan.banners (never undefined).
 */
export interface ReconcileBanner {
	kind: "empty-dir" | "empty-dir-respected";
	provider: string;
	type: string;
	global: boolean;
	path: string;
	itemCount: number;
	message: string;
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
	/**
	 * Directory states per (provider, type, global) tuple.
	 * Computed by callers via buildTypeDirectoryStates() in reconcile-state-builders.
	 * When absent, empty-dir override logic is skipped (back-compat).
	 */
	typeDirectoryStates?: TargetDirectoryState[];
	/**
	 * When true, skip the empty-dir override pass.
	 * An "empty-dir-respected" banner is still emitted so the user knows we saw it.
	 */
	respectDeletions?: boolean;
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
	/** Banners for notable batch decisions. Always an array (may be empty). */
	banners: ReconcileBanner[];
}
