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
type CCPluginSupportErrorCode =
	| "cc_not_found"
	| "cc_exec_failed"
	| "cc_version_unparseable"
	| "cc_version_too_old";

export class CCPluginSupportError extends Error {
	constructor(
		public readonly code: CCPluginSupportErrorCode,
		message: string,
		public readonly details?: string,
	) {
		super(message);
		this.name = "CCPluginSupportError";
	}
}

interface CCVersionResult {
	version: string | null;
	error?: CCPluginSupportError;
}

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
	// Unparseable versions treated as "less than" any valid version — safe fallback that blocks install
	if (!parsedA || !parsedB) return -1;

	for (let i = 0; i < 3; i++) {
		if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i];
	}
	return 0;
}

async function getCCVersionResult(): Promise<CCVersionResult> {
	try {
		const { stdout, stderr } = await execFileAsync(
			"claude",
			["--version"],
			buildExecOptions(5_000),
		);
		const output = stdout.trim();
		const match = output.match(/(\d+\.\d+\.\d+)/);

		if (!match) {
			return {
				version: null,
				error: new CCPluginSupportError(
					"cc_version_unparseable",
					"Failed to parse Claude Code version output",
					output || stderr?.trim() || "empty output",
				),
			};
		}

		return { version: match[1] };
	} catch (error) {
		const err = error as NodeJS.ErrnoException & { stderr?: string };
		if (err.code === "ENOENT") {
			return {
				version: null,
				error: new CCPluginSupportError("cc_not_found", "Claude Code CLI not found on PATH"),
			};
		}

		return {
			version: null,
			error: new CCPluginSupportError(
				"cc_exec_failed",
				"Failed to run 'claude --version'",
				(err.stderr ?? err.message ?? "Unknown error").trim(),
			),
		};
	}
}

/**
 * Get the installed Claude Code CLI version.
 * Returns the version string (e.g., "1.0.35") or null if not found/parseable.
 */
export async function getCCVersion(): Promise<string | null> {
	const result = await getCCVersionResult();
	return result.version;
}

/**
 * Check if the installed CC version supports the plugin system.
 * Throws with a descriptive message if CC is missing or too old.
 */
export async function requireCCPluginSupport(): Promise<void> {
	const result = await getCCVersionResult();
	const version = result.version;

	if (!version) {
		throw (
			result.error ??
			new CCPluginSupportError("cc_exec_failed", "Failed to determine Claude Code version")
		);
	}

	if (compareVersions(version, MIN_PLUGIN_VERSION) < 0) {
		throw new CCPluginSupportError(
			"cc_version_too_old",
			`Claude Code ${version} does not support plugins (requires >= ${MIN_PLUGIN_VERSION})`,
		);
	}

	logger.debug(`CC version ${version} supports plugins (>= ${MIN_PLUGIN_VERSION})`);
}

/** Exported for testing */
export function isCCPluginSupportError(error: unknown): error is CCPluginSupportError {
	return error instanceof CCPluginSupportError;
}

/** Exported for testing */
export { MIN_PLUGIN_VERSION, compareVersions, parseVersion };
