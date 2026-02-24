/**
 * Claude Code Version Checker
 * Validates CC version meets minimum requirements for plugin system support.
 * Plugin system requires CC >= 1.0.33.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildExecOptions } from "@/shared/claude-exec-options.js";
import { logger } from "@/shared/logger.js";

const execFileAsync = promisify(execFile);

/** Minimum CC version that supports the plugin system */
const MIN_PLUGIN_VERSION = "1.0.33";

/**
 * Parse a semver-like version string into comparable parts.
 * Returns null if parsing fails.
 */
function parseVersion(version: string): [number, number, number] | null {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) return null;
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compare two semver versions.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareVersions(a: string, b: string): number {
	const parsedA = parseVersion(a);
	const parsedB = parseVersion(b);
	if (!parsedA || !parsedB) return -1;

	for (let i = 0; i < 3; i++) {
		if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i];
	}
	return 0;
}

/**
 * Get the installed Claude Code CLI version.
 * Returns the version string (e.g., "1.0.35") or null if not found/parseable.
 */
export async function getCCVersion(): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync("claude", ["--version"], buildExecOptions(5_000));
		// Output may be "1.0.35" or "claude 1.0.35" or similar
		const match = stdout.trim().match(/(\d+\.\d+\.\d+)/);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}

/**
 * Check if the installed CC version supports the plugin system.
 * Throws with a descriptive message if CC is missing or too old.
 */
export async function requireCCPluginSupport(): Promise<void> {
	const version = await getCCVersion();

	if (!version) {
		throw new Error("Claude Code CLI not found on PATH");
	}

	if (compareVersions(version, MIN_PLUGIN_VERSION) < 0) {
		throw new Error(
			`Claude Code ${version} does not support plugins (requires >= ${MIN_PLUGIN_VERSION})`,
		);
	}

	logger.debug(`CC version ${version} supports plugins (>= ${MIN_PLUGIN_VERSION})`);
}

/** Exported for testing */
export { MIN_PLUGIN_VERSION, compareVersions, parseVersion };
