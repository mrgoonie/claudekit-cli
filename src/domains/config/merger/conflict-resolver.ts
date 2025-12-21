/**
 * Conflict resolution for hooks merge
 */
import {
	deepCopyEntry,
	extractCommands,
	getEntryCommands,
	logDuplicates,
} from "./diff-calculator.js";
import type { HookConfig, HookEntry, MergeResult } from "./types.js";

/**
 * Merge hook entries for a specific event
 * Deduplicates by command string and merges hooks with matching matchers
 *
 * Execution order: User hooks execute FIRST, then ClaudeKit hooks.
 * This is intentional - user customizations take priority and can
 * modify behavior before CK hooks run (e.g., environment setup).
 *
 * Matcher-aware merging: When source and dest have entries with the same
 * matcher value, merge their hooks arrays instead of creating duplicates.
 *
 * Partial duplicate handling: If a CK entry contains both duplicate
 * and unique commands, only unique commands are added to existing matchers.
 */
export function mergeHookEntries(
	sourceEntries: HookConfig[] | HookEntry[],
	destEntries: HookConfig[] | HookEntry[],
	eventName: string,
	result: MergeResult,
): HookConfig[] | HookEntry[] {
	// Track preserved user hook entries only if destination has hooks for this event
	if (destEntries.length > 0) {
		result.hooksPreserved += destEntries.length;
	}

	// Deep copy destination entries to avoid mutating original
	const merged: (HookConfig | HookEntry)[] = destEntries.map((entry) => deepCopyEntry(entry));

	// Build index of existing matchers for efficient lookup
	const matcherIndex = new Map<string, number>();
	for (let i = 0; i < merged.length; i++) {
		const entry = merged[i];
		if ("matcher" in entry && entry.matcher) {
			matcherIndex.set(entry.matcher, i);
		}
	}

	// Extract all existing commands from destination for deduplication
	const existingCommands = new Set<string>();
	extractCommands(destEntries, existingCommands);

	// Process each source entry
	for (const entry of sourceEntries) {
		const sourceMatcher = "matcher" in entry ? entry.matcher : undefined;
		const commands = getEntryCommands(entry);

		// Check if a matcher entry with same value already exists
		if (sourceMatcher && matcherIndex.has(sourceMatcher)) {
			// Merge hooks into existing matcher entry
			const existingIdx = matcherIndex.get(sourceMatcher);
			if (existingIdx === undefined) continue;
			const existingEntry = merged[existingIdx] as HookConfig;

			// Get new commands not already in existing entry
			const newCommands = commands.filter((cmd) => !existingCommands.has(cmd));
			const duplicateCommands = commands.filter((cmd) => existingCommands.has(cmd));

			// Log duplicates
			logDuplicates(duplicateCommands, eventName, result);

			// Add unique hooks to existing matcher
			if (newCommands.length > 0 && "hooks" in entry && entry.hooks) {
				if (!existingEntry.hooks) {
					existingEntry.hooks = [];
				}
				for (const hook of entry.hooks) {
					if (hook.command && !existingCommands.has(hook.command)) {
						existingEntry.hooks.push(hook);
						existingCommands.add(hook.command);
					}
				}
				result.hooksAdded++;
			}
		} else {
			// No matching matcher - check for full command duplication
			const isFullyDuplicated =
				commands.length > 0 && commands.every((cmd) => existingCommands.has(cmd));

			// Track duplicate commands for logging (partial or full)
			const duplicateCommands = commands.filter((cmd) => existingCommands.has(cmd));
			logDuplicates(duplicateCommands, eventName, result);

			// Add entry if not fully duplicated
			if (!isFullyDuplicated) {
				merged.push(entry);
				result.hooksAdded++;
				// Register matcher if present
				if (sourceMatcher) {
					matcherIndex.set(sourceMatcher, merged.length - 1);
				}
				// Register new commands
				for (const cmd of commands) {
					existingCommands.add(cmd);
				}
			}
		}
	}

	return merged;
}
