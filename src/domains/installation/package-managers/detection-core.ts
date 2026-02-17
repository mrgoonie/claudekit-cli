/**
 * Core detection logic for package managers
 */

import { existsSync, realpathSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { join, sep } from "node:path";
import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { PM_QUERY_TIMEOUT_MS } from "./constants.js";
import {
	type InstallInfo,
	type PackageManager,
	type PmQuery,
	execAsync,
	getBunQuery,
	getNpmQuery,
	getPnpmQuery,
	getYarnQuery,
} from "./index.js";

/** Cache file name */
const CACHE_FILE = "install-info.json";
/** Cache TTL: 30 days in milliseconds */
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
/**
 * Detect package manager from the binary's install path.
 * Resolves symlinks to find the real location of the running script,
 * then checks for PM-identifying path segments.
 * Most reliable method — works even when env vars and cache are absent.
 */
export function detectFromBinaryPath(): PackageManager {
	try {
		// process.argv[1] is the script being executed (e.g. ck.js)
		const scriptPath = process.argv[1];
		if (!scriptPath) return "unknown";

		// Resolve symlinks to get the real install location
		let resolvedPath: string;
		try {
			resolvedPath = realpathSync(scriptPath);
		} catch {
			resolvedPath = scriptPath;
		}

		// Normalize separators for cross-platform matching
		const normalized = resolvedPath.split(sep).join("/").toLowerCase();
		logger.verbose(`Binary path resolved: ${normalized}`);

		// Check for PM-identifying path segments (most specific first)
		// bun: ~/.bun/install/global/node_modules/...
		if (normalized.includes("/.bun/install/") || normalized.includes("/bun/install/global/")) {
			return "bun";
		}
		// pnpm: ~/.local/share/pnpm/global/... or pnpm/global/...
		if (normalized.includes("/pnpm/global/") || normalized.includes("/.local/share/pnpm/")) {
			return "pnpm";
		}
		// yarn: ~/.config/yarn/global/... or yarn/global/...
		if (normalized.includes("/yarn/global/") || normalized.includes("/.config/yarn/")) {
			return "yarn";
		}
		// npm: check for npm-specific global paths only (last — most generic)
		if (
			normalized.includes("/npm/node_modules/") ||
			normalized.includes("/usr/local/lib/node_modules/") ||
			normalized.includes("/usr/lib/node_modules/") ||
			normalized.includes("/opt/homebrew/lib/node_modules/") ||
			normalized.includes("/.nvm/versions/node/") ||
			normalized.includes("/n/versions/node/") ||
			normalized.includes("/appdata/roaming/npm/")
		) {
			return "npm";
		}
	} catch {
		// Non-fatal: fall through to other detection methods
	}
	return "unknown";
}

/**
 * Detect package manager from environment variables
 */
export function detectFromEnv(): PackageManager {
	// Check npm_config_user_agent (set by all major PMs)
	const userAgent = process.env.npm_config_user_agent;
	if (userAgent) {
		logger.debug(`Detected user agent: ${userAgent}`);

		if (userAgent.includes("bun/")) return "bun";
		if (userAgent.includes("yarn/")) return "yarn";
		if (userAgent.includes("pnpm/")) return "pnpm";
		if (userAgent.includes("npm/")) return "npm";
	}

	// Check npm_execpath env var
	const execPath = process.env.npm_execpath;
	if (execPath) {
		logger.debug(`Detected exec path: ${execPath}`);

		const normalizedExec = execPath.replace(/\\/g, "/").toLowerCase();
		const matchesPmExecPath = (pm: "bun" | "yarn" | "pnpm" | "npm"): boolean => {
			if (new RegExp(`(?:^|/)${pm}(?:[/.]|$)`).test(normalizedExec)) {
				return true;
			}
			// Some environments expose only executable names in npm_execpath.
			return (
				normalizedExec === pm ||
				normalizedExec === `${pm}.cmd` ||
				normalizedExec === `${pm}.exe` ||
				normalizedExec === `${pm}.js` ||
				normalizedExec === `${pm}.cjs` ||
				normalizedExec === `${pm}.mjs`
			);
		};

		// Use segment-boundary matching to avoid false positives (e.g. username "bunny")
		if (matchesPmExecPath("bun")) return "bun";
		if (matchesPmExecPath("yarn")) return "yarn";
		if (matchesPmExecPath("pnpm")) return "pnpm";
		if (matchesPmExecPath("npm")) return "npm";
	}

	return "unknown";
}

/**
 * Read cached package manager detection result
 */
export async function readCachedPm(): Promise<PackageManager | null> {
	try {
		const cacheFile = join(PathResolver.getConfigDir(false), CACHE_FILE);

		if (!existsSync(cacheFile)) {
			return null;
		}

		const content = await readFile(cacheFile, "utf-8");
		const data: InstallInfo = JSON.parse(content);

		// Validate structure
		if (!data.packageManager || !data.detectedAt) {
			logger.debug("Invalid cache structure, ignoring");
			return null;
		}

		// Check TTL
		const age = Date.now() - data.detectedAt;
		if (age < 0 || age > CACHE_TTL) {
			logger.debug(
				age < 0 ? "Cache timestamp in future, ignoring" : "Cache expired, will re-detect",
			);
			return null;
		}

		// Validate package manager value
		const validPms: PackageManager[] = ["npm", "bun", "yarn", "pnpm"];
		if (!validPms.includes(data.packageManager as PackageManager)) {
			logger.debug(`Invalid cached PM value: ${data.packageManager}`);
			return null;
		}

		return data.packageManager as PackageManager;
	} catch (error) {
		logger.debug(
			`Failed to read cache: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return null;
	}
}

/**
 * Save detected package manager to cache
 */
export async function saveCachedPm(
	pm: PackageManager,
	getVersion: (pm: PackageManager) => Promise<string | null>,
): Promise<void> {
	if (pm === "unknown") return;

	try {
		const configDir = PathResolver.getConfigDir(false);
		const cacheFile = join(configDir, CACHE_FILE);

		// Ensure config directory exists
		if (!existsSync(configDir)) {
			await mkdir(configDir, { recursive: true });
			if (platform() !== "win32") {
				await chmod(configDir, 0o700);
			}
		}

		// Get PM version for debugging
		const version = await getVersion(pm);

		const data: InstallInfo = {
			packageManager: pm,
			detectedAt: Date.now(),
			version: version ?? undefined,
		};

		await writeFile(cacheFile, JSON.stringify(data, null, 2), "utf-8");

		// Set file permissions on Unix
		if (platform() !== "win32") {
			await chmod(cacheFile, 0o600);
		}

		logger.debug(`Cached package manager: ${pm}`);
	} catch (error) {
		// Non-fatal: log and continue
		logger.debug(
			`Failed to save cache: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Query package managers to find which package manager owns the CLI package globally.
 */
export async function findOwningPm(): Promise<PackageManager | null> {
	// Define queries for each package manager (bun first as it's most common for this project)
	const queries: PmQuery[] = [getBunQuery(), getNpmQuery(), getPnpmQuery(), getYarnQuery()];

	logger.verbose("PackageManagerDetector: Querying all PMs in parallel");
	logger.debug(`Querying package managers for ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME} ownership...`);

	// Run all queries in parallel
	const results = await Promise.allSettled(
		queries.map(async ({ pm, cmd, checkFn }) => {
			try {
				logger.verbose(`PackageManagerDetector: Querying ${pm}`);
				const { stdout } = await execAsync(cmd, {
					timeout: PM_QUERY_TIMEOUT_MS,
				});
				if (checkFn(stdout)) {
					logger.verbose(`PackageManagerDetector: Found via ${pm}`);
					logger.debug(`Found ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME} installed via ${pm}`);
					return pm;
				}
				logger.verbose(`PackageManagerDetector: Not found via ${pm}`);
			} catch {
				logger.verbose(`PackageManagerDetector: ${pm} query failed or not available`);
				// PM not available or package not found - continue
			}
			return null;
		}),
	);
	logger.verbose("PackageManagerDetector: All PM queries complete");

	// Collect successful detections in declared priority order.
	const detectedPms: PackageManager[] = [];
	for (const result of results) {
		if (result.status === "fulfilled" && result.value && !detectedPms.includes(result.value)) {
			detectedPms.push(result.value);
		}
	}

	if (detectedPms.length === 1) {
		return detectedPms[0];
	}

	if (detectedPms.length > 1) {
		logger.warning(
			`Ambiguous package manager ownership for ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}: ${detectedPms.join(", ")}. Falling back to default detection.`,
		);
		return null;
	}

	logger.debug(
		`Could not determine which package manager installed ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`,
	);
	return null;
}

/**
 * Clear cached package manager detection
 */
export async function clearCache(): Promise<void> {
	try {
		const { unlink } = await import("node:fs/promises");
		const cacheFile = join(PathResolver.getConfigDir(false), CACHE_FILE);
		if (existsSync(cacheFile)) {
			await unlink(cacheFile);
			logger.debug("Package manager cache cleared");
		}
	} catch (error) {
		logger.debug(
			`Failed to clear cache: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
