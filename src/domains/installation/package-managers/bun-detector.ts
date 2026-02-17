import {
	PM_DETECTION_TARGET_PACKAGE,
	PM_VERSION_COMMAND_TIMEOUT_MS,
} from "./constants.js";
import type { PmQuery } from "./detector-base.js";
import { execAsync, isValidPackageName, isValidVersion } from "./detector-base.js";

/**
 * Get Bun query configuration
 */
export function getBunQuery(): PmQuery {
	return {
		pm: "bun",
		cmd: "bun pm ls -g",
		checkFn: (stdout) => stdout.includes(PM_DETECTION_TARGET_PACKAGE),
	};
}

/**
 * Get version command for bun
 */
export function getBunVersionCommand(): string {
	return "bun --version";
}

/**
 * Get bun version
 */
export async function getBunVersion(): Promise<string | null> {
	try {
		const { stdout } = await execAsync(getBunVersionCommand(), {
			timeout: PM_VERSION_COMMAND_TIMEOUT_MS,
		});
		return stdout.trim();
	} catch {
		return null;
	}
}

/**
 * Check if bun is available
 */
export async function isBunAvailable(): Promise<boolean> {
	try {
		await execAsync(getBunVersionCommand(), { timeout: PM_VERSION_COMMAND_TIMEOUT_MS });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get bun update command
 */
export function getBunUpdateCommand(packageName: string, version?: string): string {
	if (!isValidPackageName(packageName)) {
		throw new Error(`Invalid package name: ${packageName}`);
	}
	if (version && !isValidVersion(version)) {
		throw new Error(`Invalid version: ${version}`);
	}

	const versionSuffix = version ? `@${version}` : "@latest";
	// bun uses 'add -g' for both install and update
	return `bun add -g ${packageName}${versionSuffix}`;
}
