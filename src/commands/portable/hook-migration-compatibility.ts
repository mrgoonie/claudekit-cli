import path from "node:path";
import type { MigrationWarning, ProviderType } from "./types.js";

export interface HookEntry {
	type: string;
	command: string;
	timeout?: number;
	[key: string]: unknown;
}

export interface HookGroup {
	matcher?: string;
	hooks: HookEntry[];
}

export type HooksSection = Record<string, HookGroup[]>;

export const CODEX_SUPPORTED_HOOK_EVENTS = new Set([
	"SessionStart",
	"PreToolUse",
	"PermissionRequest",
	"PostToolUse",
	"UserPromptSubmit",
	"Stop",
]);

export const CODEX_EXCLUDED_HOOK_BASENAMES = new Set([
	"usage-context-awareness.cjs",
	"usage-quota-cache-refresh.cjs",
	"team-context-inject.cjs",
	"teammate-idle-handler.cjs",
]);

const HOOK_REF_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".sh", ".ps1", ".bat", ".cmd"]);

export function normalizeHookAssetPath(value: string): string {
	return value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^["']|["']$/g, "")
		.replace(/[),;]+$/, "")
		.replace(/^["']|["']$/g, "")
		.replace(/^\.\//, "")
		.replace(/^\$CLAUDE_PROJECT_DIR"?\/\.claude\/hooks\//, "")
		.replace(/^\$CLAUDE_PROJECT_DIR"?\/\.codex\/hooks\//, "")
		.replace(/^\$\{CLAUDE_PROJECT_DIR\}"?\/\.claude\/hooks\//, "")
		.replace(/^\$\{CLAUDE_PROJECT_DIR\}"?\/\.codex\/hooks\//, "")
		.replace(/^%CLAUDE_PROJECT_DIR%"?\/\.claude\/hooks\//, "")
		.replace(/^%CLAUDE_PROJECT_DIR%"?\/\.codex\/hooks\//, "")
		.replace(/^\$HOME\/\.claude\/hooks\//, "")
		.replace(/^\$HOME\/\.codex\/hooks\//, "")
		.replace(/^%USERPROFILE%\/\.claude\/hooks\//, "")
		.replace(/^%USERPROFILE%\/\.codex\/hooks\//, "")
		.replace(/^~\/\.claude\/hooks\//, "")
		.replace(/^~\/\.codex\/hooks\//, "")
		.replace(/^\.claude\/hooks\//, "")
		.replace(/^\.codex\/hooks\//, "")
		.replace(/^hooks\//, "")
		.replace(/^\.\//, "")
		.replace(/^\/+/, "");
}

export function hookAssetBasename(value: string): string {
	return path.posix.basename(normalizeHookAssetPath(value));
}

export function isExcludedHookAsset(value: string): boolean {
	return CODEX_EXCLUDED_HOOK_BASENAMES.has(hookAssetBasename(value));
}

export function isCodexSupportedHookEvent(event: string): boolean {
	return CODEX_SUPPORTED_HOOK_EVENTS.has(event);
}

export function extractHookReferencesFromCommand(command: string): string[] {
	const refs = new Set<string>();
	const hookDirPattern = /(?:\$HOME\/|~\/)?\.(?:claude|codex)\/hooks\/([^"'\s;&|><)]+)/g;
	for (const match of command.matchAll(hookDirPattern)) {
		const ref = normalizeHookAssetPath(match[1] ?? "");
		if (ref && HOOK_REF_EXTENSIONS.has(path.posix.extname(ref).toLowerCase())) refs.add(ref);
	}

	for (const rawToken of command.split(/\s+/)) {
		const token = normalizeHookAssetPath(rawToken);
		if (!token || refs.has(token)) continue;
		if (HOOK_REF_EXTENSIONS.has(path.posix.extname(token).toLowerCase())) refs.add(token);
	}

	return [...refs];
}

export function commandReferencesInstalledAsset(
	command: string,
	installedAssets: Set<string>,
): boolean {
	const refs = extractHookReferencesFromCommand(command).filter(
		(ref) => !isExcludedHookAsset(ref) && hookAssetBasename(ref) !== "node-hook-runner.sh",
	);
	const candidates = refs.length > 0 ? refs : extractHookReferencesFromCommand(command);

	return candidates.some((ref) => {
		const normalized = normalizeHookAssetPath(ref);
		return installedAssets.has(normalized) || installedAssets.has(hookAssetBasename(normalized));
	});
}

function warning(
	reason: string,
	message: string,
	options: { event?: string; hookFile?: string } = {},
): MigrationWarning {
	return { reason, message, ...options };
}

export function filterHooksForTarget(
	hooks: HooksSection,
	installedHookAssets: string[],
	targetProvider: ProviderType,
): { hooks: HooksSection; warnings: MigrationWarning[] } {
	const installedSet = new Set(installedHookAssets.map(normalizeHookAssetPath));
	const installedBasenames = new Set(installedHookAssets.map(hookAssetBasename));
	const installed = new Set([...installedSet, ...installedBasenames]);
	const filtered: HooksSection = {};
	const warnings: MigrationWarning[] = [];

	for (const [event, groups] of Object.entries(hooks)) {
		const unsupportedForCodex = targetProvider === "codex" && !isCodexSupportedHookEvent(event);
		if (unsupportedForCodex) {
			warnings.push(
				warning("unsupported-event", `Skipped unsupported Codex hook event ${event}`, { event }),
			);
			continue;
		}

		const filteredGroups: HookGroup[] = [];

		for (const group of groups) {
			const keptHooks: HookEntry[] = [];
			for (const entry of group.hooks) {
				const refs = extractHookReferencesFromCommand(entry.command);
				const hookFiles = refs.length > 0 ? refs : [entry.command];
				for (const ref of hookFiles) {
					const normalized = normalizeHookAssetPath(ref);
					if (isExcludedHookAsset(normalized)) {
						warnings.push(
							warning("excluded-hook", `Skipped excluded hook ${hookAssetBasename(normalized)}`, {
								event,
								hookFile: hookAssetBasename(normalized),
							}),
						);
					} else if (
						!installed.has(normalized) &&
						!installed.has(hookAssetBasename(normalized)) &&
						hookAssetBasename(normalized) !== "node-hook-runner.sh"
					) {
						warnings.push(
							warning("missing-hook-file", `Hook file not installed: ${normalized}`, {
								event,
								hookFile: normalized,
							}),
						);
					}
				}

				if (unsupportedForCodex) continue;
				if (refs.some(isExcludedHookAsset)) continue;
				if (!commandReferencesInstalledAsset(entry.command, installed)) continue;
				keptHooks.push(entry);
			}

			if (keptHooks.length > 0) filteredGroups.push({ ...group, hooks: keptHooks });
		}

		if (filteredGroups.length > 0) filtered[event] = filteredGroups;
	}

	return { hooks: filtered, warnings: dedupeWarnings(warnings) };
}

export function normalizeCodexHookContent(content: string): string {
	return content
		.replace(/\.claude\/hooks/g, ".codex/hooks")
		.replace(/~\/\.claude\/hooks/g, "~/.codex/hooks")
		.replace(/\$HOME\/\.claude\/hooks/g, "$HOME/.codex/hooks")
		.replace(/(["'`])\.claude\1/g, "$1.codex$1")
		.replace(/(["'`])~\/\.claude\1/g, "$1~/.codex$1");
}

export function dedupeWarnings(warnings: MigrationWarning[]): MigrationWarning[] {
	const seen = new Set<string>();
	return warnings.filter((item) => {
		const key = JSON.stringify([item.reason, item.event, item.hookFile, item.message]);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
