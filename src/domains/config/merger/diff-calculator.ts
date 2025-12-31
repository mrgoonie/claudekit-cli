/**
 * Diff calculation utilities for settings merge
 */
import type { HookConfig, HookEntry, MergeResult } from "./types.js";

/**
 * Truncate command string for display
 */
export function truncateCommand(cmd: string, maxLen = 50): string {
	if (cmd.length <= maxLen) return cmd;
	return `${cmd.slice(0, maxLen - 3)}...`;
}

/**
 * Deep copy a hook entry to avoid mutating originals
 */
export function deepCopyEntry(entry: HookConfig | HookEntry): HookConfig | HookEntry {
	if ("hooks" in entry) {
		return {
			...entry,
			hooks: entry.hooks ? [...entry.hooks.map((h) => ({ ...h }))] : undefined,
		};
	}
	return { ...entry };
}

/**
 * Extract all command strings from hook entries
 */
export function extractCommands(entries: (HookConfig | HookEntry)[], commands: Set<string>): void {
	for (const entry of entries) {
		if ("command" in entry && entry.command) {
			commands.add(entry.command);
		}
		if ("hooks" in entry && entry.hooks) {
			for (const hook of entry.hooks) {
				if (hook.command) {
					commands.add(hook.command);
				}
			}
		}
	}
}

/**
 * Get all commands from a single entry
 */
export function getEntryCommands(entry: HookConfig | HookEntry): string[] {
	const commands: string[] = [];
	if ("command" in entry && entry.command) {
		commands.push(entry.command);
	}
	if ("hooks" in entry && entry.hooks) {
		for (const hook of entry.hooks) {
			if (hook.command) {
				commands.push(hook.command);
			}
		}
	}
	return commands;
}

/**
 * Log duplicate commands to result conflicts
 */
export function logDuplicates(
	duplicateCommands: string[],
	eventName: string,
	result: MergeResult,
): void {
	if (duplicateCommands.length > 0) {
		const summary =
			duplicateCommands.length === 1
				? `"${truncateCommand(duplicateCommands[0])}"`
				: `${duplicateCommands.length} commands`;
		result.conflictsDetected.push(`${eventName}: duplicate ${summary}`);
	}
}
