/**
 * Locate Claude Code CLI installation across different installation methods
 * Searches: which claude, global npm, npx cache, local node_modules
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { LocatorResult } from "./swarm-mode-types.js";

/**
 * Extract Claude Code version from package.json
 *
 * @param cliJsPath - Path to cli.js file
 * @returns Version string or "unknown"
 */
function extractVersion(cliJsPath: string): string {
	try {
		const packageJsonPath = join(dirname(cliJsPath), "package.json");
		if (!existsSync(packageJsonPath)) {
			return "unknown";
		}

		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
		return packageJson.version || "unknown";
	} catch {
		return "unknown";
	}
}

/**
 * Try to locate cli.js using `which claude` command
 *
 * @returns LocatorResult if found, null otherwise
 */
function tryWhichClaude(): LocatorResult | null {
	try {
		// Get the path to the claude binary
		const command = process.platform === "win32" ? "where claude" : "which claude";
		const claudeBinPath = execSync(command, { encoding: "utf8" }).trim().split("\n")[0];
		if (!claudeBinPath || !existsSync(claudeBinPath)) {
			return null;
		}

		// Resolve symlinks to get the actual binary location
		const realPath = realpathSync(claudeBinPath);
		const stats = statSync(realPath);
		if (!stats.isFile()) {
			return null;
		}

		// bun: symlink resolves directly to cli.js (realPath ends with cli.js)
		if (realPath.endsWith("cli.js") && existsSync(realPath)) {
			return {
				path: realPath,
				method: "which-claude",
				version: extractVersion(realPath),
			};
		}

		// npm: binary is in /path/to/node_modules/@anthropic-ai/claude-code/bin/claude
		// So cli.js is at: /path/to/node_modules/@anthropic-ai/claude-code/cli.js
		const binDir = dirname(realPath);
		const packageDir = dirname(binDir);
		const cliJsPath = join(packageDir, "cli.js");

		if (!existsSync(cliJsPath)) {
			return null;
		}

		return {
			path: cliJsPath,
			method: "which-claude",
			version: extractVersion(cliJsPath),
		};
	} catch {
		return null;
	}
}

/**
 * Try to locate cli.js in global npm installation
 *
 * @returns LocatorResult if found, null otherwise
 */
function tryGlobalNpm(): LocatorResult | null {
	try {
		// Common global npm paths by platform
		const globalPaths =
			process.platform === "win32"
				? [
						join(
							process.env.APPDATA || "",
							"npm",
							"node_modules",
							"@anthropic-ai",
							"claude-code",
							"cli.js",
						),
						join(
							homedir(),
							".bun",
							"install",
							"global",
							"node_modules",
							"@anthropic-ai",
							"claude-code",
							"cli.js",
						),
					]
				: process.platform === "darwin"
					? [
							"/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
							"/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js",
							join(
								homedir(),
								".bun",
								"install",
								"global",
								"node_modules",
								"@anthropic-ai",
								"claude-code",
								"cli.js",
							),
						]
					: [
							"/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js",
							"/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
							join(
								homedir(),
								".bun",
								"install",
								"global",
								"node_modules",
								"@anthropic-ai",
								"claude-code",
								"cli.js",
							),
						];

		for (const path of globalPaths) {
			if (existsSync(path)) {
				return {
					path,
					method: "global-npm",
					version: extractVersion(path),
				};
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Try to locate cli.js in npx cache
 *
 * @returns LocatorResult if found, null otherwise
 */
function tryNpxCache(): LocatorResult | null {
	try {
		const home = homedir();
		const npxCacheDir = join(home, ".npm", "_npx");

		if (!existsSync(npxCacheDir)) {
			return null;
		}

		// Find all cached instances
		const cacheEntries = readdirSync(npxCacheDir);

		for (const entry of cacheEntries) {
			const cliJsPath = join(
				npxCacheDir,
				entry,
				"node_modules",
				"@anthropic-ai",
				"claude-code",
				"cli.js",
			);

			if (existsSync(cliJsPath)) {
				return {
					path: cliJsPath,
					method: "npx-cache",
					version: extractVersion(cliJsPath),
				};
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Try to locate cli.js in local node_modules
 *
 * @returns LocatorResult if found, null otherwise
 */
function tryLocal(): LocatorResult | null {
	try {
		const cwd = process.cwd();
		const cliJsPath = join(cwd, "node_modules", "@anthropic-ai", "claude-code", "cli.js");

		if (existsSync(cliJsPath)) {
			return {
				path: cliJsPath,
				method: "local",
				version: extractVersion(cliJsPath),
			};
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Locate the Claude Code CLI installation
 * Searches in order: which claude, global npm, npx cache, local node_modules
 *
 * @returns LocatorResult if found, null otherwise
 */
export async function locateCliJs(): Promise<LocatorResult | null> {
	// Try methods in priority order
	const methods = [tryWhichClaude, tryGlobalNpm, tryNpxCache, tryLocal];

	for (const method of methods) {
		const result = method();
		if (result) {
			return result;
		}
	}

	return null;
}
