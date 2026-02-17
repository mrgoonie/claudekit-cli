import { isWindows } from "@/shared/environment.js";
import {
	PM_DETECTION_TARGET_PACKAGE,
	PM_VERSION_COMMAND_TIMEOUT_MS,
} from "./constants.js";
import type { PmQuery } from "./detector-base.js";
import { execAsync, isValidPackageName, isValidVersion } from "./detector-base.js";

/**
 * Get PNPM query configuration
 */
export function getPnpmQuery(): PmQuery {
	return {
		pm: "pnpm",
		cmd: isWindows()
			? `pnpm.cmd ls -g ${PM_DETECTION_TARGET_PACKAGE}`
			: `pnpm ls -g ${PM_DETECTION_TARGET_PACKAGE}`,
		checkFn: (stdout) => stdout.includes(PM_DETECTION_TARGET_PACKAGE),
	};
}

/**
 * Get version command for pnpm
 */
export function getPnpmVersionCommand(): string {
	return isWindows() ? "pnpm.cmd --version" : "pnpm --version";
}

/**
 * Get pnpm version
 */
export async function getPnpmVersion(): Promise<string | null> {
	try {
		const { stdout } = await execAsync(getPnpmVersionCommand(), {
			timeout: PM_VERSION_COMMAND_TIMEOUT_MS,
		});
		return stdout.trim();
	} catch {
		return null;
	}
}

/**
 * Check if pnpm is available
 */
export async function isPnpmAvailable(): Promise<boolean> {
	try {
		await execAsync(getPnpmVersionCommand(), { timeout: PM_VERSION_COMMAND_TIMEOUT_MS });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get pnpm update command
 */
export function getPnpmUpdateCommand(packageName: string, version?: string): string {
	if (!isValidPackageName(packageName)) {
		throw new Error(`Invalid package name: ${packageName}`);
	}
	if (version && !isValidVersion(version)) {
		throw new Error(`Invalid version: ${version}`);
	}

	const versionSuffix = version ? `@${version}` : "@latest";
	// pnpm add -g handles updates
	return isWindows()
		? `pnpm.cmd add -g ${packageName}${versionSuffix}`
		: `pnpm add -g ${packageName}${versionSuffix}`;
}
