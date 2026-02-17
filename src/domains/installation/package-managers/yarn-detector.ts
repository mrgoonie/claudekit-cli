import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { isWindows } from "@/shared/environment.js";
import { PM_VERSION_COMMAND_TIMEOUT_MS } from "./constants.js";
import type { PmQuery } from "./detector-base.js";
import { execAsync, isValidPackageName, isValidVersion } from "./detector-base.js";

/**
 * Get Yarn query configuration
 */
export function getYarnQuery(): PmQuery {
	return {
		pm: "yarn",
		cmd: isWindows()
			? `yarn.cmd global list --pattern ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`
			: `yarn global list --pattern ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME}`,
		checkFn: (stdout) => stdout.includes(CLAUDEKIT_CLI_NPM_PACKAGE_NAME),
	};
}

/**
 * Get version command for yarn
 */
export function getYarnVersionCommand(): string {
	return isWindows() ? "yarn.cmd --version" : "yarn --version";
}

/**
 * Get yarn version
 */
export async function getYarnVersion(): Promise<string | null> {
	try {
		const { stdout } = await execAsync(getYarnVersionCommand(), {
			timeout: PM_VERSION_COMMAND_TIMEOUT_MS,
		});
		return stdout.trim();
	} catch {
		return null;
	}
}

/**
 * Check if yarn is available
 */
export async function isYarnAvailable(): Promise<boolean> {
	try {
		await execAsync(getYarnVersionCommand(), { timeout: PM_VERSION_COMMAND_TIMEOUT_MS });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get yarn update command
 */
export function getYarnUpdateCommand(packageName: string, version?: string): string {
	if (!isValidPackageName(packageName)) {
		throw new Error(`Invalid package name: ${packageName}`);
	}
	if (version && !isValidVersion(version)) {
		throw new Error(`Invalid version: ${version}`);
	}

	const versionSuffix = version ? `@${version}` : "@latest";
	// yarn global add handles updates
	return isWindows()
		? `yarn.cmd global add ${packageName}${versionSuffix}`
		: `yarn global add ${packageName}${versionSuffix}`;
}
