/**
 * Hooks settings.json merger — reads hooks from source provider's settings.json,
 * rewrites paths, filters to installed files, and merges into target settings.json.
 *
 * Used by `ck migrate` to auto-register hooks after copying hook files.
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { providers } from "./provider-registry.js";
import type { ProviderType } from "./types.js";

/** A single hook entry in settings.json */
interface HookEntry {
	type: string;
	command: string;
	timeout?: number;
	[key: string]: unknown;
}

/** A hook group (matcher + hooks array) */
interface HookGroup {
	matcher?: string;
	hooks: HookEntry[];
}

/** The hooks section: event name -> array of hook groups */
type HooksSection = Record<string, HookGroup[]>;

/** Options for the main orchestrator */
export interface MigrateHooksSettingsOptions {
	sourceProvider: ProviderType;
	targetProvider: ProviderType;
	installedHookFiles: string[];
	global: boolean;
}

/** Result of the hooks settings merge */
export interface MigrateHooksSettingsResult {
	success: boolean;
	backupPath: string | null;
	hooksRegistered: number;
	error?: string;
	message?: string;
}

/**
 * Read and parse the hooks section from a settings.json file.
 * Returns null if file missing, unreadable, or has no hooks key.
 */
export async function readHooksFromSettings(settingsPath: string): Promise<HooksSection | null> {
	try {
		if (!existsSync(settingsPath)) return null;
		const raw = await Bun.file(settingsPath).text();
		const parsed = JSON.parse(raw);
		if (!parsed.hooks || typeof parsed.hooks !== "object") return null;
		return parsed.hooks as HooksSection;
	} catch {
		return null;
	}
}

/**
 * Rewrite hook command paths from source provider dir to target provider dir.
 * Handles both global ($HOME-based) and project-level (relative) paths.
 */
export function rewriteHookPaths(
	hooks: HooksSection,
	sourceHooksDir: string,
	targetHooksDir: string,
): HooksSection {
	if (sourceHooksDir === targetHooksDir) return hooks;

	// Append trailing slash so we match exact directory, not substrings like `.claude/hooks-extra`
	const src = sourceHooksDir.endsWith("/") ? sourceHooksDir : `${sourceHooksDir}/`;
	const tgt = targetHooksDir.endsWith("/") ? targetHooksDir : `${targetHooksDir}/`;

	const rewritten: HooksSection = {};
	for (const [event, groups] of Object.entries(hooks)) {
		rewritten[event] = groups.map((group) => ({
			...group,
			hooks: group.hooks.map((entry) => ({
				...entry,
				// replaceAll rewrites ALL occurrences in the command string — including
				// arguments and env vars that reference the hooks directory. This is intentional:
				// the entire hook should be self-contained within the hooks directory.
				command: entry.command.replaceAll(src, tgt),
			})),
		}));
	}
	return rewritten;
}

/**
 * Filter hooks to only those referencing files that were actually installed.
 * Drops empty groups and empty event arrays after filtering.
 */
export function filterToInstalledHooks(
	hooks: HooksSection,
	installedFiles: string[],
): HooksSection {
	const installedSet = new Set(installedFiles);
	const filtered: HooksSection = {};

	for (const [event, groups] of Object.entries(hooks)) {
		const filteredGroups: HookGroup[] = [];
		for (const group of groups) {
			const matchingHooks = group.hooks.filter((entry) => {
				// Extract filename from command string (e.g., 'node "$HOME/.claude/hooks/session-init.cjs"')
				const filename = extractFilenameFromCommand(entry.command);
				return filename ? installedSet.has(filename) : false;
			});
			if (matchingHooks.length > 0) {
				filteredGroups.push({ ...group, hooks: matchingHooks });
			}
		}
		if (filteredGroups.length > 0) {
			filtered[event] = filteredGroups;
		}
	}
	return filtered;
}

/**
 * Extract the hook filename from a command string.
 * E.g., 'node "$HOME/.claude/hooks/session-init.cjs"' -> 'session-init.cjs'
 */
function extractFilenameFromCommand(command: string): string | null {
	// Strip pipes, redirects, and trailing args before extracting filename
	const normalized = command.replace(/\s*[|>&].*$/, "").trim();
	// Try quoted path first — handles spaces in filenames/directories
	const quotedMatch = normalized.match(/["']([^"']+\.(?:js|cjs|mjs|ts))["']/);
	if (quotedMatch) return quotedMatch[1].split(/[\\/]/).pop() ?? null;
	// Match unquoted path/file.ext pattern (handles trailing args like --verbose)
	const match = normalized.match(/[\\/]([^"\\/\s]+\.\w+)/);
	if (match) return match[1];
	// Fallback: find first token with a file extension
	const tokens = normalized.split(/\s+/);
	for (const token of tokens) {
		const clean = token.replace(/["']/g, "");
		if (/\.\w+$/.test(clean)) return basename(clean);
	}
	return null;
}

/**
 * Merge new hooks into target settings.json.
 * Creates backup of existing file, deduplicates by command string per event+matcher.
 */
export async function mergeHooksIntoSettings(
	targetSettingsPath: string,
	newHooks: HooksSection,
): Promise<{ backupPath: string | null }> {
	// Read existing settings (create empty object if missing)
	let existingSettings: Record<string, unknown> = {};
	let backupPath: string | null = null;

	if (existsSync(targetSettingsPath)) {
		let raw: string;
		try {
			raw = await Bun.file(targetSettingsPath).text();
			existingSettings = JSON.parse(raw);
		} catch {
			existingSettings = {};
			raw = "";
		}

		// Create backup — reuse raw from first read instead of reading file again
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		backupPath = `${targetSettingsPath}.${timestamp}.bak`;
		try {
			writeFileSync(backupPath, raw);
		} catch {
			backupPath = null;
		}
	}

	const existingHooks = (existingSettings.hooks ?? {}) as HooksSection;
	const merged = deduplicateMerge(existingHooks, newHooks);
	existingSettings.hooks = merged;

	// Atomic write: temp file + rename
	const dir = dirname(targetSettingsPath);
	mkdirSync(dir, { recursive: true });
	const tempPath = `${targetSettingsPath}.tmp`;
	try {
		writeFileSync(tempPath, JSON.stringify(existingSettings, null, 2));
		renameSync(tempPath, targetSettingsPath);
	} catch (err) {
		rmSync(tempPath, { force: true });
		throw new Error(`Failed to write settings: ${err}. Backup preserved at: ${backupPath}`);
	}

	return { backupPath };
}

/**
 * Deep-merge hooks: for each event, deduplicate by matcher + command string.
 */
function deduplicateMerge(existing: HooksSection, incoming: HooksSection): HooksSection {
	// Deep-copy existing to avoid mutating input arrays
	const merged: HooksSection = {};
	for (const [event, groups] of Object.entries(existing)) {
		merged[event] = groups.map((g) => ({ ...g, hooks: [...g.hooks] }));
	}

	for (const [event, incomingGroups] of Object.entries(incoming)) {
		const existingGroups = merged[event] ?? [];

		for (const incomingGroup of incomingGroups) {
			const matcherKey = incomingGroup.matcher ?? "";
			const existingGroup = existingGroups.find((g) => (g.matcher ?? "") === matcherKey);

			if (existingGroup) {
				// Deduplication key: event + matcher + command. If two entries share the same command
				// but differ in timeout or other fields, the existing entry takes precedence.
				const existingCommands = new Set(existingGroup.hooks.map((h) => h.command));
				for (const hook of incomingGroup.hooks) {
					if (!existingCommands.has(hook.command)) {
						existingGroup.hooks.push(hook);
					}
				}
			} else {
				existingGroups.push(incomingGroup);
			}
		}

		merged[event] = existingGroups;
	}

	return merged;
}

/**
 * Main orchestrator — called after hook files are successfully installed.
 * Reads source settings.json, rewrites paths, filters, merges into target.
 */
export async function migrateHooksSettings(
	options: MigrateHooksSettingsOptions,
): Promise<MigrateHooksSettingsResult> {
	const { sourceProvider, targetProvider, installedHookFiles, global: isGlobal } = options;

	// Currently only claude-code is supported as source (canonical hook format)
	if (options.sourceProvider !== "claude-code") {
		return {
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			message: `Hook migration from ${options.sourceProvider} not yet supported`,
		};
	}

	if (installedHookFiles.length === 0) {
		return { success: true, backupPath: null, hooksRegistered: 0 };
	}

	const sourceConfig = providers[sourceProvider];
	const targetConfig = providers[targetProvider];

	// Resolve settings.json paths
	const sourceSettingsPath = isGlobal
		? sourceConfig.settingsJsonPath?.globalPath
		: sourceConfig.settingsJsonPath?.projectPath;
	const targetSettingsPath = isGlobal
		? targetConfig.settingsJsonPath?.globalPath
		: targetConfig.settingsJsonPath?.projectPath;

	if (!sourceSettingsPath || !targetSettingsPath) {
		return {
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Provider ${!sourceSettingsPath ? sourceProvider : targetProvider} does not support hooks settings.json`,
		};
	}

	// For project-level, resolve relative to cwd
	const resolvedSourcePath = isGlobal
		? sourceSettingsPath
		: join(process.cwd(), sourceSettingsPath);
	const resolvedTargetPath = isGlobal
		? targetSettingsPath
		: join(process.cwd(), targetSettingsPath);

	// Read source hooks
	const sourceHooks = await readHooksFromSettings(resolvedSourcePath);
	if (!sourceHooks) {
		return { success: true, backupPath: null, hooksRegistered: 0 };
	}

	// Resolve hooks directories for path rewriting
	const sourceHooksDir = isGlobal
		? (sourceConfig.hooks?.globalPath ?? "")
		: (sourceConfig.hooks?.projectPath ?? "");
	const targetHooksDir = isGlobal
		? (targetConfig.hooks?.globalPath ?? "")
		: (targetConfig.hooks?.projectPath ?? "");

	// Pipeline: filter -> rewrite -> merge
	const filtered = filterToInstalledHooks(sourceHooks, installedHookFiles);
	const rewritten = rewriteHookPaths(filtered, sourceHooksDir, targetHooksDir);

	// Count hooks being registered
	let hooksRegistered = 0;
	for (const groups of Object.values(rewritten)) {
		for (const group of groups) {
			hooksRegistered += group.hooks.length;
		}
	}

	if (hooksRegistered === 0) {
		return { success: true, backupPath: null, hooksRegistered: 0 };
	}

	try {
		const { backupPath } = await mergeHooksIntoSettings(resolvedTargetPath, rewritten);
		return { success: true, backupPath, hooksRegistered };
	} catch (err) {
		return {
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Failed to merge hooks into settings.json: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}
