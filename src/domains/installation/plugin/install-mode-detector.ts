import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";

/**
 * Install-mode detection for the ClaudeKit Engineer kit.
 *
 * The kit can be present on a machine in one of four mutually exclusive modes:
 *  - "fresh"  : neither a legacy copy nor a plugin install is present
 *  - "legacy" : the kit was copied into ~/.claude/skills (the pre-plugin model)
 *  - "plugin" : the kit is installed as a Claude Code plugin (~/.claude/plugins/cache)
 *  - "mixed"  : both a legacy copy AND a plugin install are present (mid-migration)
 *
 * This module is filesystem-only and side-effect free so it is fully unit
 * testable: every reader takes an explicit claudeDir so tests can sandbox state.
 */

export const CK_PLUGIN_NAME = "ck";
export const CK_MARKETPLACE_NAME = "claudekit";
/** Kit key the CLI writes under metadata.json `kits` for a legacy copy install. */
export const ENGINEER_KIT_KEY = "engineer";

export type InstallMode = "fresh" | "legacy" | "plugin" | "mixed";

export interface PluginState {
	/** Registered in settings.json enabledPlugins (authoritative; matches `claude plugin list`). */
	installed: boolean;
	/** settings.json enabledPlugins marks the plugin enabled. */
	enabled: boolean;
	/** Resolved plugin version (cache dir name / git SHA), or null if unknown. */
	version: string | null;
	/** Marketplace the plugin was installed from, or null. */
	marketplace: string | null;
	/** Cache payload on disk but NOT registered — an orphaned cache left by uninstall. */
	staleCache: boolean;
}

export interface LegacyState {
	/** A legacy copy of the engineer kit is tracked in metadata.json. */
	installed: boolean;
	/** Version recorded for the legacy copy, or null. */
	version: string | null;
}

export interface InstallModeReport {
	mode: InstallMode;
	claudeDir: string;
	plugin: PluginState;
	legacy: LegacyState;
}

function readJsonSafe(filePath: string): unknown | null {
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Detect Claude Code plugin install state for the `ck` plugin.
 *
 * `installed` is authoritative from settings.json `enabledPlugins` (this is what
 * `claude plugin list` reflects). The plugin cache directory
 * `plugins/cache/<marketplace>/ck/<version>/` resolves the version, and when it
 * exists WITHOUT a registration it is reported as an orphaned `staleCache`
 * (uninstall removes the registration but leaves the cached payload on disk).
 */
export function detectPluginState(claudeDir: string): PluginState {
	const state: PluginState = {
		installed: false,
		enabled: false,
		version: null,
		marketplace: null,
		staleCache: false,
	};

	// Authoritative signal: settings.json enabledPlugins (key = "<plugin>@<marketplace>")
	const settings = readJsonSafe(join(claudeDir, "settings.json"));
	if (isRecord(settings) && isRecord(settings.enabledPlugins)) {
		for (const [key, value] of Object.entries(settings.enabledPlugins)) {
			const [name, marketplace] = key.split("@");
			if (name === CK_PLUGIN_NAME) {
				state.installed = true;
				state.marketplace = marketplace ?? null;
				if (value === true) state.enabled = true;
				break;
			}
		}
	}

	// Cache payload: resolves version; flags an orphaned cache when not registered.
	const cacheRoot = join(claudeDir, "plugins", "cache");
	if (existsSync(cacheRoot)) {
		for (const marketplace of safeReaddir(cacheRoot)) {
			const ckDir = join(cacheRoot, marketplace, CK_PLUGIN_NAME);
			if (existsSync(ckDir) && isDir(ckDir)) {
				state.marketplace = state.marketplace ?? marketplace;
				const versions = safeReaddir(ckDir).filter((v) => isDir(join(ckDir, v)));
				if (versions.length > 0 && state.version === null) {
					// Newest by mtime so a stale version dir does not win.
					state.version = versions
						.map((v) => ({ v, mtime: statMtime(join(ckDir, v)) }))
						.sort((a, b) => b.mtime - a.mtime)[0].v;
				}
				if (!state.installed) state.staleCache = true;
				break;
			}
		}
	}

	return state;
}

/**
 * Detect a legacy (copied-into-~/.claude) install of the engineer kit.
 *
 * Authoritative signal is metadata.json: the CLI records the kit under
 * `kits.engineer` (multi-kit format) or at the root (legacy single-kit format)
 * when it copies the payload into ~/.claude.
 */
export function detectLegacyState(claudeDir: string): LegacyState {
	const metadata = readJsonSafe(join(claudeDir, "metadata.json"));
	if (!isRecord(metadata)) return { installed: false, version: null };

	// Multi-kit format: kits.engineer
	if (isRecord(metadata.kits) && isRecord(metadata.kits[ENGINEER_KIT_KEY])) {
		const kit = metadata.kits[ENGINEER_KIT_KEY] as Record<string, unknown>;
		return { installed: true, version: typeof kit.version === "string" ? kit.version : null };
	}

	// Legacy single-kit format: root-level name/version with installed files
	const hasFiles =
		(Array.isArray((metadata as Record<string, unknown>).files) &&
			((metadata as Record<string, unknown>).files as unknown[]).length > 0) ||
		(Array.isArray((metadata as Record<string, unknown>).installedFiles) &&
			((metadata as Record<string, unknown>).installedFiles as unknown[]).length > 0);
	if (typeof metadata.version === "string" && hasFiles) {
		return { installed: true, version: metadata.version };
	}

	return { installed: false, version: null };
}

export function classifyInstallMode(plugin: PluginState, legacy: LegacyState): InstallMode {
	if (plugin.installed && legacy.installed) return "mixed";
	if (plugin.installed) return "plugin";
	if (legacy.installed) return "legacy";
	return "fresh";
}

/**
 * Full install-mode report. Defaults to the resolved global Claude config dir,
 * but accepts an explicit claudeDir for tests and multi-profile scenarios.
 */
export function detectInstallMode(
	claudeDir: string = PathResolver.getGlobalKitDir(),
): InstallModeReport {
	const plugin = detectPluginState(claudeDir);
	const legacy = detectLegacyState(claudeDir);
	return { mode: classifyInstallMode(plugin, legacy), claudeDir, plugin, legacy };
}

function safeReaddir(dir: string): string[] {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
}

function isDir(p: string): boolean {
	try {
		return statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function statMtime(p: string): number {
	try {
		return statSync(p).mtimeMs;
	} catch {
		return 0;
	}
}
