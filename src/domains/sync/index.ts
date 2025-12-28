/**
 * Sync domain facade - exports all public APIs
 */

// Types
export type {
	ConfigUpdateCache,
	FileHunk,
	MergeResult,
	SyncPlan,
	UpdateCheckResult,
} from "./types.js";

// Version checking
export { ConfigVersionChecker } from "./config-version-checker.js";

// Sync engine
export { SyncEngine, validateSyncPath } from "./sync-engine.js";

// Merge UI
export { MergeUI } from "./merge-ui.js";

// Notifications
export { displayConfigUpdateNotification } from "./notification-display.js";
