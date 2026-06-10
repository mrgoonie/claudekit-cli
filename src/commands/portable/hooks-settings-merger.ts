/**
 * Hooks settings.json merger — reads hooks from source provider's settings.json,
 * rewrites paths, filters to installed files, and merges into target settings.json.
 *
 * Used by `ck migrate` to auto-register hooks after copying hook files.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { CodexCapabilities } from "./codex-capabilities.js";
import { detectCodexCapabilities } from "./codex-capabilities.js";
import { ensureCodexHooksFeatureFlag } from "./codex-features-flag.js";
import { generateCodexHookWrappers } from "./codex-hook-wrapper.js";
import {
	type HookGroup,
	type HooksSection,
	convertClaudeHooksToCodex,
} from "./converters/claude-to-codex-hooks.js";
import {
	mapEventName,
	requiresHookMapping,
	rewriteMatcherToolNames,
} from "./converters/gemini-hook-event-map.js";
import {
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

// HookEntry, HookGroup, HooksSection are imported from converters/claude-to-codex-hooks.ts
// (single source of truth — M7 fix).

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
	/**
	 * For codex target: absolute paths to the original installed .cjs hook scripts.
	 * Used to generate wrapper scripts. If omitted when target=codex, wrapper
	 * generation is skipped and commands are rewritten via path substitution only.
	 */
	installedHookAbsolutePaths?: string[];
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
	/** Codex-only: paths of wrapper scripts generated under ~/.codex/hooks/ */
	codexWrapperPaths?: string[];
	/** Codex-only: detected capability version */
	codexCapabilitiesVersion?: string;
	/** Codex-only: whether hooks feature flag was written to config.toml */
	codexFeatureFlagWritten?: boolean;
}

interface MergeHooksOptions {
	targetProvider?: ProviderType;
	targetHooksDir?: string;
}

const CODEX_WRAPPABLE_HOOK_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts"]);

function isCodexWrappableHookPath(filePath: string): boolean {
	return (
		hookAssetBasename(filePath) !== "node-hook-runner.sh" &&
		CODEX_WRAPPABLE_HOOK_EXTENSIONS.has(extname(filePath).toLowerCase())
	);
}

/**
 * Read and parse the hooks section from a settings.json file.
 * Returns null if file missing, unreadable, or has no hooks key.
 */
export async function readHooksFromSettings(settingsPath: string): Promise<HooksSection | null> {
	const result = await inspectHooksSettings(settingsPath);
	return result.status === "ok" ? (result.hooks ?? null) : null;
}

/**
 * Validate that a parsed value conforms to HooksSection shape.
 * Each key must map to an array of HookGroup objects, each containing
 * a `hooks` array of HookEntry objects (type + command strings required).
 * Returns null on valid shape, or an error string describing the violation.
 */
function validateHooksSectionShape(value: unknown): string | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return "hooks must be a non-null object";
	}
	for (const [event, groups] of Object.entries(value as Record<string, unknown>)) {
		if (!Array.isArray(groups)) {
			return `hooks.${event} must be an array of hook groups`;
		}
		for (const group of groups as unknown[]) {
			if (!group || typeof group !== "object" || Array.isArray(group)) {
				return `hooks.${event} contains a non-object group`;
			}
			const g = group as Record<string, unknown>;
			if (!Array.isArray(g.hooks)) {
				return `hooks.${event}[].hooks must be an array`;
			}
			for (const entry of g.hooks as unknown[]) {
				if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
					return `hooks.${event}[].hooks contains a non-object entry`;
				}
				const e = entry as Record<string, unknown>;
				if (typeof e.type !== "string") {
					return `hooks.${event}[].hooks[].type must be a string`;
				}
				if (typeof e.command !== "string") {
					return `hooks.${event}[].hooks[].command must be a string`;
				}
			}
		}
	}
	return null;
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

		// Validate shape before casting — prevents downstream crashes on malformed input
		const shapeError = validateHooksSectionShape(parsed.hooks);
		if (shapeError) {
			return {
				status: "invalid-json",
				error: `hooks section has unexpected shape: ${shapeError}`,
			};
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
 * Map hook event names and matcher tool names for a target provider.
 * Currently applies to gemini-cli (Claude Code events → Gemini CLI events).
 * Unmapped events are preserved as-is (Gemini CLI ignores unknown event keys).
 */
export function mapHookEventsForProvider(
	hooks: HooksSection,
	targetProvider: ProviderType,
): HooksSection {
	if (!requiresHookMapping(targetProvider)) return hooks;

	const mapped: HooksSection = {};
	for (const [event, groups] of Object.entries(hooks)) {
		const mappedEvent = mapEventName(event);
		const mappedGroups = groups.map((group) => ({
			...group,
			// Rewrite tool names in matcher (e.g., "Edit|Write" → "replace|write_file")
			matcher: group.matcher ? rewriteMatcherToolNames(group.matcher) : group.matcher,
		}));

		// Merge into existing event key if multiple source events map to same target
		if (mapped[mappedEvent]) {
			mapped[mappedEvent].push(...mappedGroups);
		} else {
			mapped[mappedEvent] = mappedGroups;
		}
	}
	return mapped;
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
		const raw = await readFile(targetSettingsPath, "utf8");
		try {
			existingSettings = JSON.parse(raw);
		} catch {
			existingSettings = {};
		}

		// Create backup — preserves original content even if JSON was invalid
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		backupPath = `${targetSettingsPath}.${timestamp}.bak`;
		try {
			await writeFile(backupPath, raw, "utf8");
		} catch {
			backupPath = null;
		}
	} else if (Object.keys(newHooks).length === 0) {
		return { backupPath: null, hooksPruned: 0 };
	}

	const existingHooks = (existingSettings.hooks ?? {}) as HooksSection;
	const incompatibleCleanup = pruneIncompatibleHookRegistrations(existingHooks, options);
	// Self-heal broken-install entries: drop codex-target entries whose command
	// still contains a $CLAUDE_PROJECT_DIR variable token referencing a CK hook
	// dir (.claude/hooks/ or .codex/hooks/). Codex never defines this var — these
	// entries always exit 1 and cannot be deduplicated away by re-running migrate
	// (different command string). Must run BEFORE pruneStaleFileHooks so that
	// var-token entries are counted here; some forms are also caught by the
	// stale-path prune (which extracts the root-relative path), and we want the
	// count to reflect intentional var-token removal rather than a path-check side
	// effect. Gated to codex only — the var is legitimate in Claude Code settings.
	const brokenCleanup = pruneVariableTokenBrokenEntries(incompatibleCleanup.hooks, options);
	// Self-heal stale ck-managed entries: drop hooks whose command is an
	// absolute file path pointing at a missing file. Fixes the "duplicates"
	// symptom after users purge ~/.codex/hooks/ without clearing hooks.json (#739).
	const pruned = pruneStaleFileHooks(brokenCleanup.hooks);
	const merged = deduplicateMerge(pruned, newHooks);
	existingSettings.hooks = merged;

	// Atomic write: temp file + rename
	const dir = dirname(targetSettingsPath);
	await mkdir(dir, { recursive: true });
	const tempPath = `${targetSettingsPath}.tmp`;
	try {
		await writeFile(tempPath, JSON.stringify(existingSettings, null, 2), "utf8");
		await rename(tempPath, targetSettingsPath);
	} catch (err) {
		await rm(tempPath, { force: true });
		throw new Error(`Failed to write settings: ${err}. Backup preserved at: ${backupPath}`);
	}

	return {
		backupPath,
		hooksPruned: incompatibleCleanup.hooksPruned + brokenCleanup.hooksPruned,
	};
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

/**
 * Drop Codex-target entries that contain a $CLAUDE_PROJECT_DIR variable token
 * AND reference a CK-managed hook dir (.claude/hooks/ or .codex/hooks/).
 *
 * These entries are by definition broken under Codex: Codex never defines
 * CLAUDE_PROJECT_DIR, so every such hook exits 1 on every fire. They survive
 * re-runs of `ck migrate` because deduplicateMerge keys on exact command string
 * (old broken ≠ new fixed → both kept). This explicit prune repairs field-broken
 * installs without risking user-owned commands that happen to reference the var
 * for other purposes (e.g. `node "$CLAUDE_PROJECT_DIR"/scripts/own.cjs`).
 *
 * Gated to targetProvider === "codex": the var is legitimate in Claude Code settings.
 */
function pruneVariableTokenBrokenEntries(
	hooks: HooksSection,
	options: MergeHooksOptions,
): { hooks: HooksSection; hooksPruned: number } {
	if (options.targetProvider !== "codex") return { hooks, hooksPruned: 0 };

	// Matches all CLAUDE_PROJECT_DIR variable forms (plan.md §"$CLAUDE_PROJECT_DIR forms"):
	//   $CLAUDE_PROJECT_DIR  ${CLAUDE_PROJECT_DIR}  %CLAUDE_PROJECT_DIR%
	const varPattern = /\$\{?CLAUDE_PROJECT_DIR\}?|%CLAUDE_PROJECT_DIR%/;
	// CK-managed hook dirs referenced by broken entries.
	const ckHookDirPattern = /\.claude\/hooks\/|\.codex\/hooks\//;

	let hooksPruned = 0;
	const result: HooksSection = {};

	for (const [event, groups] of Object.entries(hooks)) {
		const keptGroups: HookGroup[] = [];
		for (const group of groups) {
			const keptHooks = group.hooks.filter((entry) => {
				const cmd = entry.command;
				// Drop only when BOTH conditions hold: var token present AND targets CK hook dir.
				// This preserves user hooks like `node "$CLAUDE_PROJECT_DIR"/scripts/own.cjs`.
				if (varPattern.test(cmd) && ckHookDirPattern.test(cmd)) {
					hooksPruned += 1;
					return false;
				}
				return true;
			});
			if (keptHooks.length > 0) keptGroups.push({ ...group, hooks: keptHooks });
		}
		if (keptGroups.length > 0) result[event] = keptGroups;
	}

	return { hooks: result, hooksPruned };
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
 * True if the absolute path looks like a CK-managed hook install location.
 * We only self-heal ck-owned entries to avoid silently dropping a user's
 * own absolute-path hook whose file is temporarily unavailable (network
 * mount, recently deleted, cross-platform path).
 */
function isCkManagedHookPath(absPath: string): boolean {
	// Normalize separators so the check works on POSIX and Windows.
	const normalized = absPath.replace(/\\/g, "/");
	return (
		normalized.includes("/.claude/hooks/") ||
		normalized.includes("/.codex/hooks/") ||
		normalized.includes("/.gemini/hooks/")
	);
}

/**
 * Extract every absolute-path reference inside a command string, whether
 * leading, quoted, or positioned after an interpreter. Used by self-heal
 * to detect CK-managed hook references across all Codex/Claude command
 * shapes:
 *
 *   /path/to/hook.cjs                    → ["/path/to/hook.cjs"]
 *   "/path/to/hook.cjs"                  → ["/path/to/hook.cjs"]
 *   node "/path/to/hook.cjs"             → ["/path/to/hook.cjs"]
 *   /usr/bin/env node /path/to/hook.cjs  → ["/usr/bin/env", "/path/to/hook.cjs"]
 *   npm run lint                         → []
 *
 * Regex matches POSIX-style absolute paths. Windows drive-letter paths
 * (e.g. C:\Users\...) are not matched here; the self-heal check works via
 * the codex-path-safety module for Windows paths.
 */
function extractAbsolutePaths(command: string): string[] {
	const matches: string[] = [];
	// Absolute path = leading "/" until whitespace / closing quote / closing paren.
	// Anchor the preceding character to whitespace, quote, "(", or start-of-string
	// to avoid matching paths that are substrings of URLs or other constructs.
	const pathPattern = /(?:^|[\s"'(])(\/[^\s"'()]+)/g;
	let match = pathPattern.exec(command);
	while (match !== null) {
		matches.push(match[1]);
		match = pathPattern.exec(command);
	}
	return matches;
}

/**
 * Drop CK-managed hook entries whose referenced file is missing on disk.
 * A hook is considered stale when its command references at least one
 * CK-managed absolute path AND every such reference points at a missing
 * file. This catches both the bare `/abs/path` shape and Codex's
 * `node "/abs/path"` shape (#739). Shell expressions, PATH-resolved
 * binaries, and user-owned absolute-path hooks are preserved verbatim.
 */
function pruneStaleFileHooks(existing: HooksSection): HooksSection {
	const result: HooksSection = {};
	for (const [event, groups] of Object.entries(existing)) {
		const prunedGroups: HookGroup[] = [];
		for (const group of groups) {
			const survivingHooks = group.hooks.filter((h) => {
				const paths = extractAbsolutePaths(h.command);
				const ckPaths = paths.filter(isCkManagedHookPath);
				if (ckPaths.length === 0) return true; // No CK-managed reference — keep
				// Hook is stale iff every CK-managed reference is missing.
				return ckPaths.some((p) => existsSync(p));
			});
			if (survivingHooks.length > 0) {
				prunedGroups.push({ ...group, hooks: survivingHooks });
			}
		}
		if (prunedGroups.length > 0) {
			result[event] = prunedGroups;
		}
	}
	return result;
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
 *
 * For target=codex: runs the Codex-specific compatibility pipeline instead of
 * the generic path-rewrite pipeline. See migrateHooksSettingsForCodex for details.
 */
export async function migrateHooksSettings(
	options: MigrateHooksSettingsOptions,
): Promise<MigrateHooksSettingsResult> {
	const { sourceProvider, targetProvider, installedHookFiles, global: isGlobal } = options;

	// Codex target: delegate to capability-gated pipeline
	if (targetProvider === "codex") {
		return migrateHooksSettingsForCodex(options);
	}

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

	// Pipeline: filter -> rewrite paths -> map events/matchers -> merge
	const warnings: MigrationWarning[] = [];
	const filtered = filterToInstalledHooks(sourceHooks, installedHookFiles, {
		targetProvider,
		warnings,
	});
	const rewritten = rewriteHookPaths(filtered, sourceHooksDir, targetHooksDir);
	const eventMapped = mapHookEventsForProvider(rewritten, targetProvider);

	// Count hooks being registered
	let hooksRegistered = 0;
	for (const groups of Object.values(eventMapped)) {
		for (const group of groups) {
			hooksRegistered += group.hooks.length;
		}
	}

	if (hooksRegistered === 0) {
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
			eventMapped,
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

// ---------------------------------------------------------------------------
// Codex-specific compatibility pipeline
// ---------------------------------------------------------------------------

/**
 * Codex hook migration pipeline (capability-gated).
 *
 * Steps:
 * 1. Detect Codex capabilities via `codex --version` (runs on all platforms including Windows).
 * 2. Read source hooks from claude-code settings.json.
 * 3. Filter to installed hook files.
 * 4. Generate wrapper .cjs scripts under ~/.codex/hooks/ (or project equivalent).
 * 5. Convert hooks via claude-to-codex-hooks transformer (event filter, matcher
 *    filter, additionalContext removal, path rewrite → wrapper paths).
 * 6. Merge converted hooks into ~/.codex/hooks.json.
 * 7. Ensure [features] hooks = true in ~/.codex/config.toml.
 */
async function migrateHooksSettingsForCodex(
	options: MigrateHooksSettingsOptions,
): Promise<MigrateHooksSettingsResult> {
	const {
		sourceProvider,
		installedHookFiles,
		installedHookAbsolutePaths,
		global: isGlobal,
	} = options;

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
	const codexConfig = providers.codex;

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

	// Step 2: Detect capabilities
	const capabilities: CodexCapabilities = await detectCodexCapabilities();

	// Resolve settings paths
	const sourceSettingsPath = isGlobal
		? sourceConfig.settingsJsonPath.globalPath
		: sourceConfig.settingsJsonPath.projectPath;
	const targetSettingsPath = isGlobal
		? (codexConfig.settingsJsonPath?.globalPath ?? null)
		: (codexConfig.settingsJsonPath?.projectPath ?? null);

	if (!targetSettingsPath) {
		return {
			status: "unsupported-target",
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Codex does not support hook registration for ${isGlobal ? "global" : "project"} scope`,
			sourceSettingsPath,
			targetSettingsPath: null,
		};
	}

	const resolvedSourcePath = isGlobal
		? sourceSettingsPath
		: join(process.cwd(), sourceSettingsPath);
	const resolvedTargetPath = isGlobal
		? targetSettingsPath
		: join(process.cwd(), targetSettingsPath);

	// Capture project root once, at the same point resolvedSourcePath is computed.
	// Passed to the converter so $CLAUDE_PROJECT_DIR forms are resolved to absolute
	// paths for project-scope migrations. Undefined for global scope (no env var to resolve).
	const projectDir: string | undefined = isGlobal ? undefined : process.cwd();

	// Step 3: Read source hooks
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
			codexCapabilitiesVersion: capabilities.version,
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
			codexCapabilitiesVersion: capabilities.version,
		};
	}

	if (sourceHooksResult.status === "invalid-json" || !sourceHooksResult.hooks) {
		return {
			status: "source-settings-invalid",
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Hook files were copied, but source hook registrations could not be read from ${resolvedSourcePath}: ${sourceHooksResult.error ?? "invalid JSON"}. ${resolvedTargetPath} was not updated.`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
			codexCapabilitiesVersion: capabilities.version,
		};
	}

	const sourceHooks = sourceHooksResult.hooks;

	// Step 4: Filter to installed hook files
	const warnings: MigrationWarning[] = [];
	const filtered = filterToInstalledHooks(sourceHooks, installedHookFiles, {
		targetProvider: "codex",
		warnings,
	});

	// Step 5: Generate wrapper scripts
	// Wrapper dir mirrors the target hooks dir (e.g. ~/.codex/hooks/)
	const targetHooksDir = isGlobal
		? (codexConfig.hooks?.globalPath ?? "")
		: (codexConfig.hooks?.projectPath ?? "");

	const sourceHooksDir = isGlobal
		? (sourceConfig.hooks?.globalPath ?? "")
		: (sourceConfig.hooks?.projectPath ?? "");

	// If caller provided absolute paths, generate wrappers; otherwise fall back to path rewrite.
	// commandSubstitutions maps each original absolute hook path → its hash-prefixed wrapper path.
	// This map is threaded into convertClaudeHooksToCodex so that per-file substitution
	// is performed during command rewriting (GH-730 N1 fix: directory rewrite alone pointed
	// at original copied files, not the wrappers).
	const wrapperPaths: string[] = [];
	const commandSubstitutions = new Map<string, string>();
	if (installedHookAbsolutePaths && installedHookAbsolutePaths.length > 0 && targetHooksDir) {
		const wrappableHookAbsolutePaths = installedHookAbsolutePaths.filter(isCodexWrappableHookPath);
		const wrapperResults = generateCodexHookWrappers(
			wrappableHookAbsolutePaths,
			targetHooksDir,
			capabilities,
		);
		for (const wr of wrapperResults) {
			if (wr.success) {
				wrapperPaths.push(wr.wrapperPath);
				// Commands in Claude's settings.json reference SOURCE paths (e.g.
				// `~/.claude/hooks/session-init.cjs`), but migrate-command.ts passes
				// TARGET paths (codex hooks dir) as installedHookAbsolutePaths — those
				// become wr.originalPath. Index the substitution map by both forms so
				// Phase 1 of rewriteCommandPath matches whatever the user's
				// settings.json contains.
				const addKey = (p: string) => commandSubstitutions.set(p, wr.wrapperPath);
				const base = basename(wr.originalPath);
				addKey(wr.originalPath); // target form (as returned by installer)
				if (targetHooksDir) {
					addKey(join(targetHooksDir, base));
					addKey(`./${join(targetHooksDir, base)}`);
				}
				if (sourceHooksDir) {
					const sourceAbs = join(resolve(sourceHooksDir), base);
					addKey(sourceAbs);
					addKey(join(sourceHooksDir, base));
					addKey(`./${join(sourceHooksDir, base)}`);
					// macOS: `/var` is a symlink to `/private/var`. Tmp paths and user
					// paths can appear in either form. Add both so includes() matches.
					if (sourceAbs.startsWith("/private/")) {
						addKey(sourceAbs.slice("/private".length));
					} else if (sourceAbs.startsWith("/var/")) {
						addKey(`/private${sourceAbs}`);
					}
				}
			}
		}
	}

	// Step 6: Convert hooks through Codex compatibility transformer
	// Guard: if sourceHooksDir is empty, skip path rewrite to avoid catastrophic replacement
	// where rewriteCommandPath would replace every "/" in commands with the target path.
	if (!sourceHooksDir) {
		// Return the filtered hooks converted without path rewriting
		const convertedNoRewrite = convertClaudeHooksToCodex(
			filtered,
			capabilities,
			// No pathRewrite — commands left unchanged (best-effort, safer than corrupting)
		);
		let hooksRegisteredNoRewrite = 0;
		for (const groups of Object.values(convertedNoRewrite)) {
			for (const group of groups) {
				hooksRegisteredNoRewrite += group.hooks.length;
			}
		}
		if (hooksRegisteredNoRewrite === 0) {
			return {
				status: "no-matching-hooks",
				success: true,
				backupPath: null,
				hooksRegistered: 0,
				message: `Hook files were copied, but no hooks survived Codex compatibility filtering. ${resolvedTargetPath} was not updated.`,
				sourceSettingsPath: resolvedSourcePath,
				targetSettingsPath: resolvedTargetPath,
				warnings: dedupeWarnings(warnings),
				codexCapabilitiesVersion: capabilities.version,
			};
		}
		const mergeResult = await mergeHooksIntoSettings(resolvedTargetPath, convertedNoRewrite, {
			targetProvider: "codex",
			targetHooksDir,
		});
		return {
			status: "registered",
			success: true,
			backupPath: mergeResult.backupPath,
			hooksRegistered: hooksRegisteredNoRewrite,
			hooksPruned: mergeResult.hooksPruned,
			warnings: dedupeWarnings(warnings),
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
			codexCapabilitiesVersion: capabilities.version,
		};
	}

	// pathRewrite points hook commands at wrapper scripts (or target hooks dir if no wrappers).
	// commandSubstitutions (per-file map) takes precedence over the directory-level rewrite in
	// rewriteCommandPath. For hooks not covered by the map, directory rewrite still applies as
	// fallback so non-wrapper code paths remain functional.
	// projectDir is threaded here (ONE call site) so the converter can resolve
	// $CLAUDE_PROJECT_DIR variable forms to absolute paths for project-scope migrations.
	// Global-scope migrations pass undefined → no behavior change.
	const effectiveTargetDir = targetHooksDir || sourceHooksDir;
	const converted = convertClaudeHooksToCodex(filtered, capabilities, {
		sourceDir: sourceHooksDir,
		targetDir: effectiveTargetDir,
		commandSubstitutions: commandSubstitutions.size > 0 ? commandSubstitutions : undefined,
		projectDir,
	});

	// Count hooks to register
	let hooksRegistered = 0;
	for (const groups of Object.values(converted)) {
		for (const group of groups) {
			hooksRegistered += group.hooks.length;
		}
	}

	if (hooksRegistered === 0) {
		return {
			status: "no-matching-hooks",
			success: true,
			backupPath: null,
			hooksRegistered: 0,
			message: `Hook files were copied, but no hooks survived Codex compatibility filtering (unsupported events/matchers dropped). ${resolvedTargetPath} was not updated.`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
			warnings: dedupeWarnings(warnings),
			codexCapabilitiesVersion: capabilities.version,
		};
	}

	// Step 7: Merge into hooks.json
	let backupPath: string | null = null;
	let hooksPruned = 0;
	try {
		const mergeResult = await mergeHooksIntoSettings(resolvedTargetPath, converted, {
			targetProvider: "codex",
			targetHooksDir,
		});
		backupPath = mergeResult.backupPath;
		hooksPruned = mergeResult.hooksPruned;
	} catch (err) {
		return {
			status: "merge-failed",
			success: false,
			backupPath: null,
			hooksRegistered: 0,
			error: `Failed to merge Codex hook registrations into ${resolvedTargetPath}: ${err instanceof Error ? err.message : String(err)}`,
			sourceSettingsPath: resolvedSourcePath,
			targetSettingsPath: resolvedTargetPath,
			codexCapabilitiesVersion: capabilities.version,
		};
	}

	// Step 8: Ensure [features] hooks = true in config.toml
	let featureFlagWritten = false;
	if (capabilities.requiresFeatureFlag) {
		const configTomlPath = isGlobal
			? join(homedir(), ".codex", "config.toml")
			: join(process.cwd(), ".codex", "config.toml");
		// Pass isGlobal explicitly so boundary check uses ~/.codex/ for global installs
		// and the project's .codex/ parent for project-scoped installs. This avoids a
		// false-negative when the project lives under the home directory.
		const flagResult = await ensureCodexHooksFeatureFlag(configTomlPath, isGlobal);
		featureFlagWritten = flagResult.status === "written" || flagResult.status === "updated";
		// Surface a failed flag write instead of swallowing it. Without
		// `[features] hooks = true`, Codex ignores the hooks file we just wrote,
		// so the migration is effectively a no-op. Recording a warning lets the
		// caller report it and lets the next run self-heal the drift.
		if (flagResult.status === "failed") {
			warnings.push({
				reason: "codex-feature-flag-write-failed",
				message: `Codex hooks are registered but enabling them failed: ${
					flagResult.error ?? "unknown error"
				}. Run \`ck migrate --agent codex\` again to retry.`,
			});
		}
	}

	return {
		status: "registered",
		success: true,
		backupPath,
		hooksRegistered,
		hooksPruned,
		warnings: dedupeWarnings(warnings),
		sourceSettingsPath: resolvedSourcePath,
		targetSettingsPath: resolvedTargetPath,
		codexWrapperPaths: wrapperPaths.length > 0 ? wrapperPaths : undefined,
		codexCapabilitiesVersion: capabilities.version,
		codexFeatureFlagWritten: featureFlagWritten,
	};
}
