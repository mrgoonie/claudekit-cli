/**
 * Package Manager Detector
 * Detect which package manager installed the CLI and generate appropriate commands
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

/**
 * Supported package managers
 */
export type PackageManager = "npm" | "bun" | "yarn" | "pnpm" | "unknown";

/**
 * Package manager detection and command generation
 */
export class PackageManagerDetector {
	/**
	 * Detect which package manager installed the CLI
	 * Detection order:
	 * 1. npm_config_user_agent env var (most reliable)
	 * 2. npm_execpath env var
	 * 3. Check available package managers
	 * 4. Default to npm
	 */
	static async detect(): Promise<PackageManager> {
		// Method 1: Check npm_config_user_agent (set by all major PMs)
		const userAgent = process.env.npm_config_user_agent;
		if (userAgent) {
			logger.debug(`Detected user agent: ${userAgent}`);

			if (userAgent.includes("bun/")) return "bun";
			if (userAgent.includes("yarn/")) return "yarn";
			if (userAgent.includes("pnpm/")) return "pnpm";
			if (userAgent.includes("npm/")) return "npm";
		}

		// Method 2: Check npm_execpath env var
		const execPath = process.env.npm_execpath;
		if (execPath) {
			logger.debug(`Detected exec path: ${execPath}`);

			if (execPath.includes("bun")) return "bun";
			if (execPath.includes("yarn")) return "yarn";
			if (execPath.includes("pnpm")) return "pnpm";
			if (execPath.includes("npm")) return "npm";
		}

		// Method 3: Check which package managers are available
		// Prefer bun if available (faster)
		const pmChecks: PackageManager[] = ["bun", "pnpm", "yarn", "npm"];

		for (const pm of pmChecks) {
			if (await PackageManagerDetector.isAvailable(pm)) {
				logger.debug(`Fallback detection: using ${pm}`);
				return pm;
			}
		}

		// Method 4: Default to npm (most common)
		logger.debug("No package manager detected, defaulting to npm");
		return "npm";
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
		const platform = process.platform;
		const isWindows = platform === "win32";

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
	 * Get the command to update a global package
	 * @param pm - Package manager to use
	 * @param packageName - Name of the package to update
	 * @param version - Optional specific version (default: latest)
	 */
	static getUpdateCommand(pm: PackageManager, packageName: string, version?: string): string {
		const versionSuffix = version ? `@${version}` : "@latest";
		const platform = process.platform;
		const isWindows = platform === "win32";

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
			const { stdout } = await execAsync(command, { timeout: 3000 });
			return stdout.trim();
		} catch {
			return null;
		}
	}
}
