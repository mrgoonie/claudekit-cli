/**
 * Merger module exports
 */
export type {
	HookConfig,
	HookEntry,
	McpServerConfig,
	MergeOptions,
	MergeResult,
	SettingsJson,
} from "./types.js";
export { mergeHooks, mergeMcp, mergeSettings } from "./merge-engine.js";
export { mergeHookEntries } from "./conflict-resolver.js";
export {
	deepCopyEntry,
	extractCommands,
	getEntryCommands,
	logDuplicates,
	truncateCommand,
} from "./diff-calculator.js";
export { atomicWriteFile, readSettingsFile, writeSettingsFile } from "./file-io.js";
