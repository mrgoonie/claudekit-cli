/**
 * Swarm domain - CK Swarm patch engine
 * Enables multi-agent swarm mode in Claude Code CLI
 */

// Re-export types
export type { SwarmModeState, SwarmState, LocatorResult } from "./swarm-mode-types.js";

// Re-export patch functions
export {
	findSwarmGateFunction,
	detectSwarmModeState,
	patchSwarmGate,
	getSwarmGateInfo,
	type SwarmGateInfo,
	type PatchResult,
} from "./swarm-gate-patcher.js";

// Re-export locator
export { locateCliJs } from "./claude-cli-js-locator.js";

// Re-export backup functions
export {
	createBackup,
	restoreFromBackup,
	hasBackup,
	getBackupPath,
} from "./swarm-backup-manager.js";

// Re-export state functions
export { readSwarmState, writeSwarmState, clearSwarmState } from "./swarm-state-manager.js";

// Re-export hook functions
export { installSwarmHook, removeSwarmHook, isHookInstalled } from "./swarm-hook-manager.js";
export { SWARM_HOOK_FILENAME } from "./hook-template.js";

// Re-export skill installer functions
export {
	installSwarmSkill,
	removeSwarmSkill,
	isSwarmSkillInstalled,
} from "./swarm-skill-installer.js";

// Re-export locking utilities
export { acquireLock, releaseLock, withLock } from "./file-locking-for-parallel-runs.js";
