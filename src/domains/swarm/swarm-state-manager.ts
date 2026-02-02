/**
 * Persistent state management for swarm patches
 * Stores state at ~/.claude/.ck-swarm-state.json
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import type { SwarmState } from "./swarm-mode-types.js";

/**
 * Get the path to the swarm state file
 *
 * @returns Absolute path to the state file
 */
function getStatePath(): string {
	const globalKitDir = PathResolver.getGlobalKitDir();
	return join(globalKitDir, ".ck-swarm-state.json");
}

/**
 * Read the current swarm state from disk
 *
 * @returns SwarmState if exists, null otherwise
 */
export function readSwarmState(): SwarmState | null {
	const statePath = getStatePath();

	if (!existsSync(statePath)) {
		return null;
	}

	try {
		const content = readFileSync(statePath, "utf8");
		const state = JSON.parse(content) as SwarmState;

		// Validate required fields
		if (
			typeof state.enabled !== "boolean" ||
			typeof state.cliJsPath !== "string" ||
			typeof state.cliJsHash !== "string" ||
			typeof state.backupPath !== "string" ||
			typeof state.ccVersion !== "string" ||
			typeof state.patchedAt !== "string"
		) {
			// Invalid state structure - treat as missing
			return null;
		}

		return state;
	} catch {
		// Failed to parse or read - treat as missing
		return null;
	}
}

/**
 * Write swarm state to disk atomically
 * Uses temp file + rename for atomicity
 *
 * @param state - State to write
 */
export function writeSwarmState(state: SwarmState): void {
	const statePath = getStatePath();
	const tempPath = `${statePath}.tmp`;
	const stateDir = dirname(statePath);

	try {
		// Ensure parent directory exists
		if (!existsSync(stateDir)) {
			mkdirSync(stateDir, { recursive: true });
		}

		// Write to temp file
		const content = JSON.stringify(state, null, 2);
		writeFileSync(tempPath, content, "utf8");

		// Atomic rename
		renameSync(tempPath, statePath);
	} catch (error) {
		// Clean up temp file if it exists
		if (existsSync(tempPath)) {
			try {
				unlinkSync(tempPath);
			} catch {
				// Ignore cleanup errors
			}
		}

		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to write swarm state: ${message}`);
	}
}

/**
 * Clear/delete the swarm state file
 */
export function clearSwarmState(): void {
	const statePath = getStatePath();

	if (existsSync(statePath)) {
		try {
			unlinkSync(statePath);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to clear swarm state: ${message}`);
		}
	}
}
