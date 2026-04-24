/**
 * Re-export reconcile types for UI components
 * UI cannot directly import from @/commands, so we re-export types here
 *
 * IMPORTANT: Keep structurally identical to src/commands/portable/reconcile-types.ts
 * P2 additions: ReconcileReason, ReconcileBanner, TargetDirectoryState,
 * reasonCode/reasonCopy/isDirectoryItem on ReconcileAction, banners on ReconcilePlan
 */

/** Action types the reconciler can determine */
export type ReconcileActionType = "install" | "update" | "skip" | "conflict" | "delete";

/**
 * Structured reason codes for reconcile decisions.
 * Mirror of server-side ReconcileReason — keep in sync with reconcile-types.ts.
 */
export type ReconcileReason =
	// install bucket
	| "new-item"
	| "new-provider-for-item"
	| "target-deleted-source-changed"
	| "target-dir-empty-reinstall"
	| "force-reinstall"
	| "force-overwrite"
	| "registry-upgrade-reinstall"
	// update bucket
	| "source-changed"
	| "registry-upgrade-heal"
	// skip bucket
	| "no-changes"
	| "user-edits-preserved"
	| "user-deleted-respected"
	| "target-up-to-date-backfill"
	| "provider-checksum-unavailable"
	| "target-state-unknown"
	// delete bucket
	| "source-removed-orphan"
	| "renamed-cleanup"
	| "path-migrated-cleanup"
	// conflict bucket
	| "both-changed"
	| "target-state-unknown-source-changed";

/**
 * A banner emitted by the reconciler to inform UI of notable batch decisions.
 * Mirror of server-side ReconcileBanner — keep in sync with reconcile-types.ts.
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

/**
 * State of a provider's type directory.
 * Mirror of server-side TargetDirectoryState — keep in sync with reconcile-types.ts.
 */
export interface TargetDirectoryState {
	provider: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	global: boolean;
	path: string;
	exists: boolean;
	isEmpty: boolean;
	fileCount: number;
}

/** A single action to take for one (item, provider) combination */
export interface ReconcileAction {
	action: ReconcileActionType;
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	provider: string;
	global: boolean;
	targetPath: string;
	reason: string;

	// P2 additions — structured reason code + copy (additive; old `reason` preserved for back-compat)
	reasonCode?: ReconcileReason;
	reasonCopy?: string;

	// True for skill type (directory-based install)
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

/** A candidate item for Install mode picker */
export interface InstallCandidate {
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules" | "hooks";
	provider: string;
	global: boolean;
	isDirectoryItem: boolean;
	description?: string;
	sourcePath: string;
	alreadyInstalled: boolean;
	registryPath?: string;
}

/** Response from GET /api/migrate/install-discovery */
export interface InstallDiscoveryResponse {
	candidates: InstallCandidate[];
	typeDirectoryStates: TargetDirectoryState[];
}
