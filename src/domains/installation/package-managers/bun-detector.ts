import { getPmVersionCommandTimeoutMs } from "./constants.js";
import type { PmQuery } from "./detector-base.js";
import { execAsync, isValidPackageName, isValidVersion } from "./detector-base.js";

/**
 * Get Bun query configuration
 */
export function getBunQuery(): PmQuery {
	return {
		pm: "bun",
		cmd: "bun pm ls -g",
		checkFn: (stdout) => /(?:^|[^a-z0-9-])claudekit-cli@/m.test(stdout),
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
			timeout: getPmVersionCommandTimeoutMs(),
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
		await execAsync(getBunVersionCommand(), { timeout: getPmVersionCommandTimeoutMs() });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get bun update command
 */
export function getBunUpdateCommand(
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
	// bun uses 'add -g' for both install and update
	return `bun add -g ${packageName}${versionSuffix}${registryFlag}`;
}
