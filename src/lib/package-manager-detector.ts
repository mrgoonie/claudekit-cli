/**
 * Package Manager Detector
 * Detect which package manager installed the CLI and generate appropriate commands
 *
 * Detection hierarchy:
 * 1. Environment variables (npm_config_user_agent, npm_execpath) - fastest, works during install
 * 2. Cached config (~/.claudekit/install-info.json) - fast, reliable for updates
 * 3. Query PMs (npm ls -g, etc.) - reliable fallback, identifies true owner
 * 4. Default to npm with warning - last resort
 */

import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import { PathResolver } from "../utils/path-resolver.js";

const execAsync = promisify(exec);

/**
 * Supported package managers
 */
export type PackageManager = "npm" | "bun" | "yarn" | "pnpm" | "unknown";

/**
 * Cache structure for storing detected package manager
 */
interface InstallInfo {
	packageManager: PackageManager;
	detectedAt: number; // timestamp in ms
	version?: string; // PM version at detection time
}

/**
 * Package manager detection and command generation
 */
export class PackageManagerDetector {
	/** Cache file name */
	private static readonly CACHE_FILE = "install-info.json";
	/** Cache TTL: 30 days in milliseconds */
	private static readonly CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
	/** Query timeout: 5 seconds */
	private static readonly QUERY_TIMEOUT = 5000;

	/**
	 * Detect which package manager installed the CLI
	 * Detection order:
	 * 1. npm_config_user_agent env var (most reliable during install)
	 * 2. npm_execpath env var
	 * 3. Cached config (reliable for updates)
	 * 4. Query PMs to find owner
	 * 5. Default to npm with warning
	 */
	static async detect(): Promise<PackageManager> {
		logger.verbose("PackageManagerDetector: Starting detection");
		// Method 1 & 2: Check environment variables (fastest, works during install)
		const envPm = PackageManagerDetector.detectFromEnv();
		if (envPm !== "unknown") {
			logger.verbose(`PackageManagerDetector: Detected from env: ${envPm}`);
			return envPm;
		}

		// Method 3: Check cached detection result
		logger.verbose("PackageManagerDetector: Checking cache");
		const cachedPm = await PackageManagerDetector.readCachedPm();
		if (cachedPm) {
			logger.verbose(`PackageManagerDetector: Using cached: ${cachedPm}`);
			logger.debug(`Using cached package manager: ${cachedPm}`);
			return cachedPm;
		}

		// Method 4: Query package managers to find which one owns claudekit-cli
		logger.verbose("PackageManagerDetector: Querying package managers");
		const owningPm = await PackageManagerDetector.findOwningPm();
		if (owningPm) {
			logger.verbose(`PackageManagerDetector: Found owning PM: ${owningPm}`);
			// Cache for next time
			await PackageManagerDetector.saveCachedPm(owningPm);
			return owningPm;
		}

		// Method 5: Default to npm with warning
		logger.verbose("PackageManagerDetector: Defaulting to npm");
		logger.warning(
			"Could not detect package manager that installed claudekit-cli, defaulting to npm",
		);
		return "npm";
	}

	/**
	 * Detect package manager from environment variables
	 * These are set by package managers when running scripts
	 * @returns Package manager or "unknown" if not detected
	 */
	private static detectFromEnv(): PackageManager {
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

			if (execPath.includes("bun")) return "bun";
			if (execPath.includes("yarn")) return "yarn";
			if (execPath.includes("pnpm")) return "pnpm";
			if (execPath.includes("npm")) return "npm";
		}

		return "unknown";
	}

	/**
	 * Read cached package manager detection result
	 * @returns Cached package manager or null if not found/expired/invalid
	 */
	static async readCachedPm(): Promise<PackageManager | null> {
		try {
			const cacheFile = join(PathResolver.getConfigDir(false), PackageManagerDetector.CACHE_FILE);

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
			if (age > PackageManagerDetector.CACHE_TTL) {
				logger.debug("Cache expired, will re-detect");
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
	 * @param pm - Package manager to cache
	 */
	static async saveCachedPm(pm: PackageManager): Promise<void> {
		if (pm === "unknown") return;

		try {
			const configDir = PathResolver.getConfigDir(false);
			const cacheFile = join(configDir, PackageManagerDetector.CACHE_FILE);

			// Ensure config directory exists
			if (!existsSync(configDir)) {
				await mkdir(configDir, { recursive: true });
				if (platform() !== "win32") {
					await chmod(configDir, 0o700);
				}
			}

			// Get PM version for debugging
			const version = await PackageManagerDetector.getVersion(pm);

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
	 * Query package managers to find which one has claudekit-cli installed globally
	 * Runs queries in parallel for speed
	 * @returns Package manager that owns claudekit-cli, or null if not found
	 */
	static async findOwningPm(): Promise<PackageManager | null> {
		const isWindows = process.platform === "win32";

		// Define queries for each package manager
		const queries: Array<{
			pm: PackageManager;
			cmd: string;
			checkFn: (stdout: string) => boolean;
		}> = [
			{
				pm: "npm",
				cmd: isWindows
					? "npm.cmd ls -g claudekit-cli --depth=0 --json"
					: "npm ls -g claudekit-cli --depth=0 --json",
				checkFn: (stdout) => {
					try {
						const data = JSON.parse(stdout);
						// npm ls -g --json returns dependencies object with package name as key
						return !!(data.dependencies?.["claudekit-cli"] || stdout.includes("claudekit-cli"));
					} catch {
						return stdout.includes("claudekit-cli");
					}
				},
			},
			{
				pm: "pnpm",
				cmd: isWindows ? "pnpm.cmd ls -g claudekit-cli" : "pnpm ls -g claudekit-cli",
				checkFn: (stdout) => stdout.includes("claudekit-cli"),
			},
			{
				pm: "yarn",
				cmd: isWindows
					? "yarn.cmd global list --pattern claudekit-cli"
					: "yarn global list --pattern claudekit-cli",
				checkFn: (stdout) => stdout.includes("claudekit-cli"),
			},
			{
				pm: "bun",
				cmd: "bun pm ls -g",
				checkFn: (stdout) => stdout.includes("claudekit-cli"),
			},
		];

		logger.verbose("PackageManagerDetector: Querying all PMs in parallel");
		logger.debug("Querying package managers for claudekit-cli ownership...");

		// Run all queries in parallel
		const results = await Promise.allSettled(
			queries.map(async ({ pm, cmd, checkFn }) => {
				try {
					logger.verbose(`PackageManagerDetector: Querying ${pm}`);
					const { stdout } = await execAsync(cmd, {
						timeout: PackageManagerDetector.QUERY_TIMEOUT,
					});
					if (checkFn(stdout)) {
						logger.verbose(`PackageManagerDetector: Found via ${pm}`);
						logger.debug(`Found claudekit-cli installed via ${pm}`);
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

		// Find first successful detection
		for (const result of results) {
			if (result.status === "fulfilled" && result.value) {
				return result.value;
			}
		}

		logger.debug("Could not determine which package manager installed claudekit-cli");
		return null;
	}

	/**
	 * Check if a package manager is available on the system
	 */
	static async isAvailable(pm: PackageManager): Promise<boolean> {
		if (pm === "unknown") return false;

		const command = PackageManagerDetector.getVersionCommand(pm);

		try {
			await execAsync(command, { timeout: 3000 });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get version command for a package manager
	 */
	private static getVersionCommand(pm: PackageManager): string {
		const isWindows = process.platform === "win32";

		switch (pm) {
			case "npm":
				return isWindows ? "npm.cmd --version" : "npm --version";
			case "bun":
				return "bun --version";
			case "yarn":
				return isWindows ? "yarn.cmd --version" : "yarn --version";
			case "pnpm":
				return isWindows ? "pnpm.cmd --version" : "pnpm --version";
			default:
				return "echo unknown";
		}
	}

	/**
	 * Validate npm package name to prevent shell injection
	 * @see https://github.com/npm/validate-npm-package-name
	 */
	private static isValidPackageName(name: string): boolean {
		// npm package name: optional @scope/ prefix, followed by alphanumeric with .-_
		return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name);
	}

	/**
	 * Validate semver version string
	 */
	private static isValidVersion(version: string): boolean {
		// Allow semver, ranges, and tags (latest, beta, etc.)
		return /^[a-zA-Z0-9._-]+$/.test(version);
	}

	/**
	 * Get the command to update a global package
	 * @param pm - Package manager to use
	 * @param packageName - Name of the package to update
	 * @param version - Optional specific version (default: latest)
	 * @throws Error if packageName or version contains invalid characters
	 */
	static getUpdateCommand(pm: PackageManager, packageName: string, version?: string): string {
		// Validate inputs to prevent shell injection
		if (!PackageManagerDetector.isValidPackageName(packageName)) {
			throw new Error(`Invalid package name: ${packageName}`);
		}
		if (version && !PackageManagerDetector.isValidVersion(version)) {
			throw new Error(`Invalid version: ${version}`);
		}

		const versionSuffix = version ? `@${version}` : "@latest";
		const isWindows = process.platform === "win32";

		switch (pm) {
			case "bun":
				// bun uses 'add -g' for both install and update
				return `bun add -g ${packageName}${versionSuffix}`;

			case "yarn":
				// yarn global add handles updates
				return isWindows
					? `yarn.cmd global add ${packageName}${versionSuffix}`
					: `yarn global add ${packageName}${versionSuffix}`;

			case "pnpm":
				// pnpm add -g handles updates
				return isWindows
					? `pnpm.cmd add -g ${packageName}${versionSuffix}`
					: `pnpm add -g ${packageName}${versionSuffix}`;
			default:
				// npm install -g handles updates
				return isWindows
					? `npm.cmd install -g ${packageName}${versionSuffix}`
					: `npm install -g ${packageName}${versionSuffix}`;
		}
	}

	/**
	 * Get the command to install a global package
	 * (Same as update for most package managers)
	 */
	static getInstallCommand(pm: PackageManager, packageName: string, version?: string): string {
		return PackageManagerDetector.getUpdateCommand(pm, packageName, version);
	}

	/**
	 * Get human-readable name for package manager
	 */
	static getDisplayName(pm: PackageManager): string {
		switch (pm) {
			case "npm":
				return "npm";
			case "bun":
				return "Bun";
			case "yarn":
				return "Yarn";
			case "pnpm":
				return "pnpm";
			default:
				return "Unknown";
		}
	}

	/**
	 * Get package manager version
	 */
	static async getVersion(pm: PackageManager): Promise<string | null> {
		if (pm === "unknown") return null;

		const command = PackageManagerDetector.getVersionCommand(pm);

		try {
			logger.verbose(`PackageManagerDetector: Getting version for ${pm}`);
			const { stdout } = await execAsync(command, { timeout: 3000 });
			const version = stdout.trim();
			logger.verbose(`PackageManagerDetector: ${pm} version: ${version}`);
			return version;
		} catch {
			logger.verbose(`PackageManagerDetector: Failed to get ${pm} version`);
			return null;
		}
	}

	/**
	 * Clear cached package manager detection
	 * Useful for testing or when user wants to force re-detection
	 */
	static async clearCache(): Promise<void> {
		try {
			const { unlink } = await import("node:fs/promises");
			const cacheFile = join(PathResolver.getConfigDir(false), PackageManagerDetector.CACHE_FILE);
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
}
