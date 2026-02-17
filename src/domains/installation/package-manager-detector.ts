/**
 * Package Manager Detector - Facade for package manager detection and command generation
 *
 * This module is split into:
 * - package-managers/detector-base.ts: Common types and utilities
 * - package-managers/npm-detector.ts: NPM detection
 * - package-managers/bun-detector.ts: Bun detection
 * - package-managers/yarn-detector.ts: Yarn detection
 * - package-managers/pnpm-detector.ts: PNPM detection
 * - package-managers/detection-core.ts: Core detection logic
 */

import { logger } from "@/shared/logger.js";
import {
	PM_DETECTION_TARGET_PACKAGE,
	PM_VERSION_COMMAND_TIMEOUT_MS,
} from "./package-managers/constants.js";
import {
	type PackageManager,
	clearCache,
	detectFromBinaryPath,
	detectFromEnv,
	execAsync,
	findOwningPm,
	getBunUpdateCommand,
	getBunVersion,
	getBunVersionCommand,
	getNpmUpdateCommand,
	getNpmVersion,
	getNpmVersionCommand,
	getPnpmUpdateCommand,
	getPnpmVersion,
	getPnpmVersionCommand,
	getYarnUpdateCommand,
	getYarnVersion,
	getYarnVersionCommand,
	isValidPackageName,
	isValidVersion,
	readCachedPm,
	saveCachedPm,
} from "./package-managers/index.js";

// Re-export type for external use
export type { PackageManager };

/**
 * Package manager detection and command generation
 */
export class PackageManagerDetector {
	/**
	 * Detect which package manager installed the CLI.
	 *
	 * Priority order:
	 * 1. Binary path (most reliable — checks where the running script lives)
	 * 2. Environment variables (fast, set by PM when running scripts)
	 * 3. Cache (with binary-path validation to prevent stale results)
	 * 4. Parallel PM query (slow but comprehensive)
	 * 5. Default to npm
	 */
	static async detect(): Promise<PackageManager> {
		logger.verbose("PackageManagerDetector: Starting detection");

		// Method 1: Check binary install path (most reliable)
		const binaryPm = detectFromBinaryPath();
		if (binaryPm !== "unknown") {
			logger.verbose(`PackageManagerDetector: Detected from binary path: ${binaryPm}`);
			// Update cache if it disagrees
			const cachedPm = await readCachedPm();
			if (cachedPm && cachedPm !== binaryPm) {
				logger.verbose(
					`PackageManagerDetector: Cache says ${cachedPm}, binary says ${binaryPm} — updating cache`,
				);
				await saveCachedPm(binaryPm, PackageManagerDetector.getVersion);
			} else if (!cachedPm) {
				await saveCachedPm(binaryPm, PackageManagerDetector.getVersion);
			}
			return binaryPm;
		}

		// Method 2: Check environment variables
		const envPm = detectFromEnv();
		if (envPm !== "unknown") {
			logger.verbose(`PackageManagerDetector: Detected from env: ${envPm}`);
			return envPm;
		}

		// Method 3: Check cached detection result
		logger.verbose("PackageManagerDetector: Checking cache");
		const cachedPm = await readCachedPm();
		if (cachedPm) {
			logger.verbose(`PackageManagerDetector: Using cached: ${cachedPm}`);
			return cachedPm;
		}

		// Method 4: Query package managers
		logger.verbose("PackageManagerDetector: Querying package managers");
		const owningPm = await findOwningPm();
		if (owningPm) {
			logger.verbose(`PackageManagerDetector: Found owning PM: ${owningPm}`);
			await saveCachedPm(owningPm, PackageManagerDetector.getVersion);
			return owningPm;
		}

		// Method 5: Default to npm
		logger.verbose("PackageManagerDetector: Defaulting to npm");
		logger.warning(
			`Could not detect package manager that installed ${PM_DETECTION_TARGET_PACKAGE}, defaulting to npm`,
		);
		return "npm";
	}

	/** Read cached package manager */
	static readCachedPm = readCachedPm;

	/** Save cached package manager */
	static async saveCachedPm(pm: PackageManager): Promise<void> {
		return saveCachedPm(pm, PackageManagerDetector.getVersion);
	}

	/** Find owning package manager */
	static findOwningPm = findOwningPm;

	/** Check if a package manager is available */
	static async isAvailable(pm: PackageManager): Promise<boolean> {
		if (pm === "unknown") return false;
		try {
			await execAsync(PackageManagerDetector.getVersionCommand(pm), {
				timeout: PM_VERSION_COMMAND_TIMEOUT_MS,
			});
			return true;
		} catch {
			return false;
		}
	}

	/** Get version command for a package manager */
	private static getVersionCommand(pm: PackageManager): string {
		switch (pm) {
			case "npm":
				return getNpmVersionCommand();
			case "bun":
				return getBunVersionCommand();
			case "yarn":
				return getYarnVersionCommand();
			case "pnpm":
				return getPnpmVersionCommand();
			default:
				return "echo unknown";
		}
	}

	/** Get the command to update a global package */
	static getUpdateCommand(pm: PackageManager, packageName: string, version?: string): string {
		if (!isValidPackageName(packageName)) throw new Error(`Invalid package name: ${packageName}`);
		if (version && !isValidVersion(version)) throw new Error(`Invalid version: ${version}`);

		switch (pm) {
			case "bun":
				return getBunUpdateCommand(packageName, version);
			case "yarn":
				return getYarnUpdateCommand(packageName, version);
			case "pnpm":
				return getPnpmUpdateCommand(packageName, version);
			default:
				return getNpmUpdateCommand(packageName, version);
		}
	}

	/** Get the command to install a global package */
	static getInstallCommand(pm: PackageManager, packageName: string, version?: string): string {
		return PackageManagerDetector.getUpdateCommand(pm, packageName, version);
	}

	/** Get human-readable name for package manager */
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

	/** Get package manager version */
	static async getVersion(pm: PackageManager): Promise<string | null> {
		switch (pm) {
			case "npm":
				return getNpmVersion();
			case "bun":
				return getBunVersion();
			case "yarn":
				return getYarnVersion();
			case "pnpm":
				return getPnpmVersion();
			default:
				return null;
		}
	}

	/** Clear cached package manager detection */
	static clearCache = clearCache;
}
