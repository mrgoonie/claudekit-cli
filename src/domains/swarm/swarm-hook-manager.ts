/**
 * Swarm Hook Manager — Install/remove SessionStart hook for auto-reapply
 *
 * Manages the ck-swarm-auto-reapply.cjs hook in ~/.claude/hooks/
 * and its registration in ~/.claude/settings.json
 */

import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import { SWARM_HOOK_FILENAME, getSwarmHookContent } from "./hook-template.js";

/**
 * Get the full path to the hook file
 */
function getHookPath(): string {
	return join(PathResolver.getGlobalKitDir(), "hooks", SWARM_HOOK_FILENAME);
}

/**
 * Get the full path to settings.json
 */
function getSettingsPath(): string {
	return join(PathResolver.getGlobalKitDir(), "settings.json");
}

/**
 * Build the hook command string for settings.json registration
 */
function getHookCommand(): string {
	const hookPath = getHookPath();
	// Quote path to handle spaces
	return `node "${hookPath}"`;
}

/**
 * Check if a hook entry matches ck-swarm (by command containing the filename)
 */
function isSwarmHookEntry(entry: { command?: string }): boolean {
	return typeof entry.command === "string" && entry.command.includes("ck-swarm");
}

/**
 * Read and parse settings.json, returning empty object if missing/invalid
 */
function readSettings(): Record<string, unknown> {
	const settingsPath = getSettingsPath();
	if (!existsSync(settingsPath)) return {};
	try {
		return JSON.parse(readFileSync(settingsPath, "utf-8"));
	} catch {
		return {};
	}
}

/**
 * Write settings.json with 2-space indent, preserving all keys
 */
function writeSettings(settings: Record<string, unknown>): void {
	const settingsPath = getSettingsPath();
	const tempPath = `${settingsPath}.tmp`;
	const settingsDir = PathResolver.getGlobalKitDir();

	mkdirSync(settingsDir, { recursive: true });

	// Atomic write: temp + rename
	writeFileSync(tempPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
	renameSync(tempPath, settingsPath);
}

/**
 * Install the swarm auto-reapply hook
 *
 * 1. Writes hook .cjs file to ~/.claude/hooks/
 * 2. Registers hook in settings.json under hooks.SessionStart
 * 3. Idempotent — safe to call multiple times
 */
export function installSwarmHook(): void {
	const hookPath = getHookPath();
	const hooksDir = join(PathResolver.getGlobalKitDir(), "hooks");

	// Write hook file
	mkdirSync(hooksDir, { recursive: true });
	writeFileSync(hookPath, getSwarmHookContent(), "utf-8");
	chmodSync(hookPath, 0o755);

	// Register in settings.json
	const settings = readSettings();

	if (!settings.hooks || typeof settings.hooks !== "object") {
		settings.hooks = {};
	}
	const hooks = settings.hooks as Record<string, unknown>;

	if (!Array.isArray(hooks.SessionStart)) {
		hooks.SessionStart = [];
	}
	const sessionStart = hooks.SessionStart as Array<{ type?: string; command?: string }>;

	// Check if already registered
	const alreadyRegistered = sessionStart.some(isSwarmHookEntry);
	if (!alreadyRegistered) {
		sessionStart.push({
			type: "command",
			command: getHookCommand(),
		});
	}

	writeSettings(settings);
}

/**
 * Remove the swarm auto-reapply hook
 *
 * 1. Deletes hook .cjs file from ~/.claude/hooks/
 * 2. Removes ck-swarm entry from settings.json
 * 3. Cleans up empty hooks/SessionStart arrays
 */
export function removeSwarmHook(): void {
	// Delete hook file
	const hookPath = getHookPath();
	if (existsSync(hookPath)) {
		unlinkSync(hookPath);
	}

	// Remove from settings.json
	const settingsPath = getSettingsPath();
	if (!existsSync(settingsPath)) return;

	const settings = readSettings();
	const hooks = settings.hooks as Record<string, unknown> | undefined;
	if (!hooks || typeof hooks !== "object") return;

	const sessionStart = hooks.SessionStart;
	if (!Array.isArray(sessionStart)) return;

	// Filter out ck-swarm entries
	const filtered = sessionStart.filter((entry: { command?: string }) => !isSwarmHookEntry(entry));

	if (filtered.length === 0) {
		hooks.SessionStart = undefined;
		// Clean up empty hooks object
		if (Object.keys(hooks).length === 0) {
			settings.hooks = undefined;
		}
	} else {
		hooks.SessionStart = filtered;
	}

	writeSettings(settings);
}

/**
 * Check if the swarm hook is currently installed
 * Verifies both file existence AND settings.json registration
 */
export function isHookInstalled(): boolean {
	if (!existsSync(getHookPath())) return false;

	const settings = readSettings();
	const hooks = settings.hooks as Record<string, unknown> | undefined;
	if (!hooks || typeof hooks !== "object") return false;

	const sessionStart = hooks.SessionStart;
	if (!Array.isArray(sessionStart)) return false;

	return sessionStart.some((entry: { command?: string }) => isSwarmHookEntry(entry));
}
