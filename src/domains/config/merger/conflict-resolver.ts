/**
 * Conflict resolution for hooks merge
 */
import { logger, normalizeCommand } from "@/shared";
import {
	deepCopyEntry,
	extractCommands,
	getEntryCommands,
	logDuplicates,
} from "./diff-calculator.js";
import type { HookConfig, HookEntry, MergeResult } from "./types.js";

/**
 * Check if a command was previously installed by CK
 * Normalizes commands for consistent comparison across path variable formats
 */
function wasCommandInstalled(command: string, installedHooks: string[]): boolean {
	const normalizedCommand = normalizeCommand(command);
	return installedHooks.some((hook) => normalizeCommand(hook) === normalizedCommand);
}

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
 *
 * User deletion respect: If installedHooks contains a command but it's
 * not in destination, user removed it - skip re-adding.
 */
export function mergeHookEntries(
	sourceEntries: HookConfig[] | HookEntry[],
	destEntries: HookConfig[] | HookEntry[],
	eventName: string,
	result: MergeResult,
	installedHooks: string[] = [],
	sourceKit?: string,
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

		// Check if user removed any of these commands (was installed before but not in dest)
		const userRemovedCommands = commands.filter(
			(cmd) =>
				!existingCommands.has(normalizeCommand(cmd)) && wasCommandInstalled(cmd, installedHooks),
		);

		if (userRemovedCommands.length > 0) {
			// User intentionally removed these - skip re-adding
			result.hooksSkipped += userRemovedCommands.length;
			for (const cmd of userRemovedCommands) {
				logger.verbose(`Skipping hook (user removed): ${cmd.slice(0, 50)}...`);
			}
			// If ALL commands were removed, skip the entire entry
			if (userRemovedCommands.length === commands.length) {
				continue;
			}
		}

		// Check if a matcher entry with same value already exists
		if (sourceMatcher && matcherIndex.has(sourceMatcher)) {
			// Merge hooks into existing matcher entry
			const existingIdx = matcherIndex.get(sourceMatcher);
			if (existingIdx === undefined) continue;
			const existingEntry = merged[existingIdx] as HookConfig;

			// Get new commands not already in existing entry and not user-removed
			const newCommands = commands.filter(
				(cmd) =>
					!existingCommands.has(normalizeCommand(cmd)) && !wasCommandInstalled(cmd, installedHooks),
			);
			const duplicateCommands = commands.filter((cmd) =>
				existingCommands.has(normalizeCommand(cmd)),
			);

			// Log duplicates
			logDuplicates(duplicateCommands, eventName, result);

			// Add unique hooks to existing matcher
			if (newCommands.length > 0 && "hooks" in entry && entry.hooks) {
				if (!existingEntry.hooks) {
					existingEntry.hooks = [];
				}
				for (const hook of entry.hooks) {
					if (
						hook.command &&
						!existingCommands.has(normalizeCommand(hook.command)) &&
						!wasCommandInstalled(hook.command, installedHooks)
					) {
						// Tag hook with origin if sourceKit provided
						const taggedHook = sourceKit ? { ...hook, _origin: sourceKit } : hook;
						existingEntry.hooks.push(taggedHook);
						existingCommands.add(normalizeCommand(hook.command));
						result.newlyInstalledHooks.push(hook.command);
						// Track in hooksByOrigin
						if (sourceKit) {
							trackHookOrigin(result, sourceKit, hook.command);
						}
					}
				}
				result.hooksAdded++;
			}
		} else {
			// No matching matcher - check for full command duplication
			const isFullyDuplicated =
				commands.length > 0 && commands.every((cmd) => existingCommands.has(normalizeCommand(cmd)));

			// Track duplicate commands for logging (partial or full)
			const duplicateCommands = commands.filter((cmd) =>
				existingCommands.has(normalizeCommand(cmd)),
			);
			logDuplicates(duplicateCommands, eventName, result);

			// Check if entry should be added:
			// - If no commands (malformed/empty), add it (can't determine user removal)
			// - If has commands, check if at least one is new and not user-removed
			const hasNonRemovedCommands =
				commands.length === 0 ||
				commands.some(
					(cmd) =>
						!existingCommands.has(normalizeCommand(cmd)) &&
						!wasCommandInstalled(cmd, installedHooks),
				);

			if (!isFullyDuplicated && hasNonRemovedCommands) {
				// Filter out user-removed hooks before adding entry
				let filteredEntry = entry;
				if ("hooks" in entry && entry.hooks && userRemovedCommands.length > 0) {
					const filteredHooks = entry.hooks.filter(
						(h) => !h.command || !wasCommandInstalled(h.command, installedHooks),
					);
					filteredEntry = { ...entry, hooks: filteredHooks };
				} else if ("command" in entry && wasCommandInstalled(entry.command, installedHooks)) {
					// Single command entry that was removed - skip entirely
					continue;
				}

				// Tag hooks with origin before adding
				const taggedEntry = sourceKit
					? tagHooksWithOrigin(filteredEntry, sourceKit)
					: filteredEntry;
				merged.push(taggedEntry);
				result.hooksAdded++;
				// Register matcher if present
				if (sourceMatcher) {
					matcherIndex.set(sourceMatcher, merged.length - 1);
				}
				// Register new commands and track newly installed
				for (const cmd of commands) {
					const normalizedCmd = normalizeCommand(cmd);
					if (!existingCommands.has(normalizedCmd) && !wasCommandInstalled(cmd, installedHooks)) {
						existingCommands.add(normalizedCmd);
						result.newlyInstalledHooks.push(cmd);
						// Track in hooksByOrigin
						if (sourceKit) {
							trackHookOrigin(result, sourceKit, cmd);
						}
					} else if (!existingCommands.has(normalizedCmd)) {
						existingCommands.add(normalizedCmd);
					}
				}
			}
		}
	}

	return merged;
}

/**
 * Tag hook entries with origin kit (internal use only)
 */
function tagHooksWithOrigin(entry: HookConfig | HookEntry, kit: string): HookConfig | HookEntry {
	if ("hooks" in entry && entry.hooks) {
		return {
			...entry,
			hooks: entry.hooks.map((h) => ({ ...h, _origin: kit })),
		};
	}
	if ("command" in entry) {
		return { ...entry, _origin: kit };
	}
	return entry;
}

/**
 * Track a hook command in the hooksByOrigin map
 */
function trackHookOrigin(result: MergeResult, kit: string, command: string): void {
	const existing = result.hooksByOrigin.get(kit) || [];
	existing.push(command);
	result.hooksByOrigin.set(kit, existing);
}
