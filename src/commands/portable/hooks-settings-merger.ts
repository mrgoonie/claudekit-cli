/**
 * Hooks settings.json merger — reads hooks from source provider's settings.json,
 * rewrites paths, filters to installed files, and merges into target settings.json.
 *
 * Used by `ck migrate` to auto-register hooks after copying hook files.
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	type HookGroup,
	type HooksSection,
	commandReferencesInstalledAsset,
	dedupeWarnings,
	extractHookReferencesFromCommand,
	filterHooksForTarget,
	hookAssetBasename,
	isCodexSupportedHookEvent,
	isExcludedHookAsset,
	normalizeHookAssetPath,
} from "./hook-migration-compatibility.js";
import { providers } from "./provider-registry.js";
import type { MigrationWarning, ProviderType } from "./types.js";

type HooksSettingsReadStatus = "ok" | "missing-file" | "invalid-json" | "missing-hooks";

interface HooksSettingsReadResult {
	status: HooksSettingsReadStatus;
	hooks?: HooksSection;
	error?: string;
}

export type HooksMigrationStatus =
	| "registered"
	| "no-compatible-hooks"
	| "no-installed-files"
	| "unsupported-source"
	| "unsupported-target"
	| "source-settings-missing"
	| "source-settings-invalid"
	| "source-hooks-missing"
	| "no-matching-hooks"
	| "merge-failed";

/** Options for the main orchestrator */
export interface MigrateHooksSettingsOptions {
	sourceProvider: ProviderType;
	targetProvider: ProviderType;
	installedHookFiles: string[];
	global: boolean;
}

/** Result of the hooks settings merge */
export interface MigrateHooksSettingsResult {
	status: HooksMigrationStatus;
	success: boolean;
	backupPath: string | null;
	hooksRegistered: number;
	hooksPruned?: number;
	warnings?: MigrationWarning[];
	error?: string;
	message?: string;
	sourceSettingsPath: string | null;
	targetSettingsPath: string | null;
}

interface MergeHooksOptions {
	targetProvider?: ProviderType;
	targetHooksDir?: string;
}

/**
 * Read and parse the hooks section from a settings.json file.
 * Returns null if file missing, unreadable, or has no hooks key.
 */
export async function readHooksFromSettings(settingsPath: string): Promise<HooksSection | null> {
	const result = await inspectHooksSettings(settingsPath);
	return result.status === "ok" ? (result.hooks ?? null) : null;
}

async function inspectHooksSettings(settingsPath: string): Promise<HooksSettingsReadResult> {
	try {
		if (!existsSync(settingsPath)) {
			return { status: "missing-file" };
		}

		const raw = await readFile(settingsPath, "utf8");
		const parsed = JSON.parse(raw) as { hooks?: unknown };
		if (!parsed.hooks || typeof parsed.hooks !== "object") {
			return { status: "missing-hooks" };
		}

		return { status: "ok", hooks: parsed.hooks as HooksSection };
	} catch (error) {
		return {
			status: "invalid-json",
			error: error instanceof Error ? error.message : String(error),
		};
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
	const rewritePairs = buildHookDirRewritePairs(sourceHooksDir, targetHooksDir);

	const rewritten: HooksSection = {};
	for (const [event, groups] of Object.entries(hooks)) {
		rewritten[event] = groups.map((group) => ({
			...group,
			hooks: group.hooks.map((entry) => ({
				...entry,
				// replaceAll rewrites ALL occurrences in the command string — including
				// arguments and env vars that reference the hooks directory. This is intentional:
				// the entire hook should be self-contained within the hooks directory.
				command: rewritePairs.reduce(
					(command, [src, tgt]) => command.replaceAll(src, tgt),
					entry.command,
				),
			})),
		}));
	}
	return rewritten;
}

function normalizeDirPattern(value: string): string {
	return value.replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\.\//, "");
}

function homeRelativeDir(value: string): string {
	const normalized = normalizeDirPattern(value);
	const home = normalizeDirPattern(homedir());
	return normalized.startsWith(`${home}/`) ? normalized.slice(home.length + 1) : normalized;
}

function buildHookDirRewritePairs(
	sourceHooksDir: string,
	targetHooksDir: string,
): [string, string][] {
	const source = normalizeDirPattern(sourceHooksDir);
	const target = normalizeDirPattern(targetHooksDir);
	const sourceHomeRelative = homeRelativeDir(sourceHooksDir);
	const targetHomeRelative = homeRelativeDir(targetHooksDir);
	const candidates: [string, string][] = [
		[source, target],
		[`$HOME/${sourceHomeRelative}`, `$HOME/${targetHomeRelative}`],
		[`~/${sourceHomeRelative}`, `~/${targetHomeRelative}`],
		[sourceHomeRelative, targetHomeRelative],
	];
	const seen = new Set<string>();
	return candidates
		.filter(([src]) => src.length > 0)
		.map(([src, tgt]) => [`${src}/`, `${tgt}/`] as [string, string])
		.filter(([src, tgt]) => {
			const key = `${src}\0${tgt}`;
			if (src === tgt || seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.sort((left, right) => right[0].length - left[0].length);
}

/**
 * Filter hooks to only those referencing files that were actually installed.
 * Drops empty groups and empty event arrays after filtering.
 */
export function filterToInstalledHooks(
	hooks: HooksSection,
	installedFiles: string[],
	options: { targetProvider?: ProviderType; warnings?: MigrationWarning[] } = {},
): HooksSection {
	if (options.targetProvider) {
		const result = filterHooksForTarget(hooks, installedFiles, options.targetProvider);
		options.warnings?.push(...result.warnings);
		return result.hooks;
	}

	const installedSet = new Set(installedFiles.map(normalizeHookAssetPath));
	for (const file of installedFiles) {
		installedSet.add(hookAssetBasename(file));
	}
	const filtered: HooksSection = {};

	for (const [event, groups] of Object.entries(hooks)) {
		const filteredGroups: HookGroup[] = [];
		for (const group of groups) {
			const matchingHooks = group.hooks.filter((entry) => {
				return commandReferencesInstalledAsset(entry.command, installedSet);
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
 * Merge new hooks into target settings.json.
 * Creates backup of existing file, deduplicates by command string per event+matcher.
 */
export async function mergeHooksIntoSettings(
	targetSettingsPath: string,
	newHooks: HooksSection,
	options: MergeHooksOptions = {},
): Promise<{ backupPath: string | null; hooksPruned: number }> {
	// Read existing settings (create empty object if missing)
	let existingSettings: Record<string, unknown> = {};
	let backupPath: string | null = null;

	if (existsSync(targetSettingsPath)) {
		let raw: string;
		try {
			raw = await readFile(targetSettingsPath, "utf8");
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
	} else if (Object.keys(newHooks).length === 0) {
		return { backupPath: null, hooksPruned: 0 };
	}

	const existingHooks = (existingSettings.hooks ?? {}) as HooksSection;
	const cleanup = pruneIncompatibleHookRegistrations(existingHooks, options);
	const merged = deduplicateMerge(cleanup.hooks, newHooks);
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

	return { backupPath, hooksPruned: cleanup.hooksPruned };
}

function pruneIncompatibleHookRegistrations(
	hooks: HooksSection,
	options: MergeHooksOptions,
): { hooks: HooksSection; hooksPruned: number } {
	if (options.targetProvider !== "codex") return { hooks, hooksPruned: 0 };
	const targetHooksDir = options.targetHooksDir || ".codex/hooks";
	let hooksPruned = 0;
	const pruned: HooksSection = {};

	for (const [event, groups] of Object.entries(hooks)) {
		const keptGroups: HookGroup[] = [];
		for (const group of groups) {
			const keptHooks = group.hooks.filter((entry) => {
				const refs = extractHookReferencesFromCommand(entry.command);
				const targetOwned = commandTargetsHookDir(entry.command, targetHooksDir);
				const incompatible =
					!isCodexSupportedHookEvent(event) || refs.some((ref) => isExcludedHookAsset(ref));
				if (targetOwned && incompatible) {
					hooksPruned += 1;
					return false;
				}
				return true;
			});
			if (keptHooks.length > 0) keptGroups.push({ ...group, hooks: keptHooks });
		}
		if (keptGroups.length > 0) pruned[event] = keptGroups;
	}

	return { hooks: pruned, hooksPruned };
}

function commandTargetsHookDir(command: string, targetHooksDir: string): boolean {
	const normalizedCommand = command.replace(/\\/g, "/");
	const normalizedDir = targetHooksDir.replace(/\\/g, "/").replace(/\/+$/, "");
	return (
		normalizedCommand.includes(`${normalizedDir}/`) ||
		normalizedCommand.includes("$HOME/.codex/hooks/") ||
		normalizedCommand.includes("~/.codex/hooks/")
	);
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

	if (installedHookFiles.length === 0) {
		return {
			status: "no-installed-files",
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			sourceSettingsPath: null,
			targetSettingsPath: null,
		};
	}

	const sourceConfig = providers[sourceProvider];
	const targetConfig = providers[targetProvider];

	// Only providers with settingsJsonPath can serve as hook sources
	if (!sourceConfig.settingsJsonPath) {
		return {
			status: "unsupported-source",
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			message: `Hook settings migration from ${sourceProvider} not supported (no hooks configuration)`,
			sourceSettingsPath: null,
			targetSettingsPath: null,
		};
	}

	// Resolve settings.json paths
	const sourceSettingsPath = isGlobal
		? sourceConfig.settingsJsonPath?.globalPath
		: sourceConfig.settingsJsonPath?.projectPath;
	const targetSettingsPath = isGlobal
		? targetConfig.settingsJsonPath?.globalPath
		: targetConfig.settingsJsonPath?.projectPath;

	if (!sourceSettingsPath) {
		return {
			status: "unsupported-source",
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			message: `Hook settings migration from ${sourceProvider} not supported for ${isGlobal ? "global" : "project"} scope`,
			sourceSettingsPath: null,
			targetSettingsPath: targetSettingsPath ?? null,
		};
	}

	if (!targetSettingsPath) {
		return {
			status: "unsupported-target",
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Provider ${targetProvider} does not support hook registration for ${isGlobal ? "global" : "project"} scope`,
			sourceSettingsPath,
			targetSettingsPath: null,
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
	const sourceHooksResult = await inspectHooksSettings(resolvedSourcePath);
	if (sourceHooksResult.status === "missing-file") {
		return {
			status: "source-settings-missing",
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			message: `Hook files were copied, but source hook registrations were not found at ${resolvedSourcePath}; ${resolvedTargetPath} was not updated.`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
		};
	}

	if (sourceHooksResult.status === "missing-hooks") {
		return {
			status: "source-hooks-missing",
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			message: `Hook files were copied, but ${resolvedSourcePath} does not define a hooks section; ${resolvedTargetPath} was not updated.`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
		};
	}

	if (sourceHooksResult.status === "invalid-json") {
		return {
			status: "source-settings-invalid",
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Hook files were copied, but source hook registrations could not be read from ${resolvedSourcePath}: ${sourceHooksResult.error || "invalid JSON"}. ${resolvedTargetPath} was not updated.`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
		};
	}

	const sourceHooks = sourceHooksResult.hooks;
	if (!sourceHooks) {
		return {
			status: "source-settings-invalid",
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Hook files were copied, but source hook registrations could not be read from ${resolvedSourcePath}. ${resolvedTargetPath} was not updated.`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
		};
	}

	// Resolve hooks directories for path rewriting
	const sourceHooksDir = isGlobal
		? (sourceConfig.hooks?.globalPath ?? "")
		: (sourceConfig.hooks?.projectPath ?? "");
	const targetHooksDir = isGlobal
		? (targetConfig.hooks?.globalPath ?? "")
		: (targetConfig.hooks?.projectPath ?? "");

	// Pipeline: filter -> rewrite -> merge
	const warnings: MigrationWarning[] = [];
	const filtered = filterToInstalledHooks(sourceHooks, installedHookFiles, {
		targetProvider,
		warnings,
	});
	const rewritten = rewriteHookPaths(filtered, sourceHooksDir, targetHooksDir);

	// Count hooks being registered
	let hooksRegistered = 0;
	for (const groups of Object.values(rewritten)) {
		for (const group of groups) {
			hooksRegistered += group.hooks.length;
		}
	}

	if (hooksRegistered === 0) {
		if (targetProvider === "codex") {
			const hasCompatibilitySkip = warnings.some(
				(warning) => warning.reason === "unsupported-event" || warning.reason === "excluded-hook",
			);
			const { backupPath, hooksPruned } = await mergeHooksIntoSettings(
				resolvedTargetPath,
				{},
				{ targetProvider, targetHooksDir },
			);
			if (hooksPruned > 0 || hasCompatibilitySkip) {
				return {
					status: "no-compatible-hooks",
					success: true,
					backupPath,
					hooksRegistered: 0,
					hooksPruned,
					warnings: dedupeWarnings(warnings),
					message: `Hook files were copied, but no compatible Codex hook registrations were found in ${resolvedSourcePath}; ${hooksPruned} stale incompatible registration(s) pruned from ${resolvedTargetPath}.`,
					sourceSettingsPath: resolvedSourcePath,
					targetSettingsPath: resolvedTargetPath,
				};
			}
		}
		return {
			status: "no-matching-hooks",
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			warnings: dedupeWarnings(warnings),
			message: `Hook files were copied, but none of the installed hooks matched registrations from ${resolvedSourcePath}; ${resolvedTargetPath} was not updated.`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
		};
	}

	try {
		const { backupPath, hooksPruned } = await mergeHooksIntoSettings(
			resolvedTargetPath,
			rewritten,
			{
				targetProvider,
				targetHooksDir,
			},
		);
		return {
			status: "registered",
			success: true,
			backupPath,
			hooksRegistered,
			hooksPruned,
			warnings: dedupeWarnings(warnings),
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
		};
	} catch (err) {
		return {
			status: "merge-failed",
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Failed to merge hook registrations into ${resolvedTargetPath}: ${err instanceof Error ? err.message : String(err)}`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
		};
	}
}
