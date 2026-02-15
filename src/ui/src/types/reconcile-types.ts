/**
 * Re-export reconcile types for UI components
 * UI cannot directly import from @/commands, so we re-export types here
 */

/** Action types the reconciler can determine */
export type ReconcileActionType = "install" | "update" | "skip" | "conflict" | "delete";

/** A single action to take for one (item, provider) combination */
export interface ReconcileAction {
	action: ReconcileActionType;
	item: string;
	type: "agent" | "command" | "skill" | "config" | "rules";
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
