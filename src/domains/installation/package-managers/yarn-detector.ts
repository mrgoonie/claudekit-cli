import { isWindows } from "@/shared/environment.js";
import type { PmQuery } from "./detector-base.js";
import { execAsync, isValidPackageName, isValidVersion } from "./detector-base.js";

/**
 * Get Yarn query configuration
 */
export function getYarnQuery(): PmQuery {
	return {
		pm: "yarn",
		cmd: isWindows()
			? "yarn.cmd global list --pattern claudekit-cli"
			: "yarn global list --pattern claudekit-cli",
		checkFn: (stdout) => /(?:^|[^a-z0-9-])claudekit-cli@/m.test(stdout),
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
		const { stdout } = await execAsync(getYarnVersionCommand(), { timeout: 3000 });
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
		await execAsync(getYarnVersionCommand(), { timeout: 3000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get yarn update command
 */
export function getYarnUpdateCommand(
	packageName: string,
	version?: string,
	registryUrl?: string,
): string {
	if (!isValidPackageName(packageName)) {
		throw new Error(`Invalid package name: ${packageName}`);
	}
	if (version && !isValidVersion(version)) {
		throw new Error(`Invalid version: ${version}`);
	}

	const versionSuffix = version ? `@${version}` : "@latest";
	const registryFlag = registryUrl ? ` --registry ${registryUrl}` : "";
	// yarn global add handles updates
	return isWindows()
		? `yarn.cmd global add ${packageName}${versionSuffix}${registryFlag}`
		: `yarn global add ${packageName}${versionSuffix}${registryFlag}`;
}
