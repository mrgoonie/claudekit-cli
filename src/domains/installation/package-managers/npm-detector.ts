import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { isWindows } from "@/shared/environment.js";
import { getPmVersionCommandTimeoutMs } from "./constants.js";
import type { PmQuery } from "./detector-base.js";
import { execAsync, isValidPackageName, isValidVersion } from "./detector-base.js";

/**
 * Get NPM query configuration
 */
export function getNpmQuery(): PmQuery {
	return {
		pm: "npm",
		cmd: isWindows()
			? `npm.cmd ls -g ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME} --depth=0 --json`
			: `npm ls -g ${CLAUDEKIT_CLI_NPM_PACKAGE_NAME} --depth=0 --json`,
		checkFn: (stdout) => {
			try {
				const data = JSON.parse(stdout);
				// npm ls -g --json returns dependencies object with package name as key
				return !!(
					data.dependencies?.[CLAUDEKIT_CLI_NPM_PACKAGE_NAME] ||
					stdout.includes(CLAUDEKIT_CLI_NPM_PACKAGE_NAME)
				);
			} catch {
				return stdout.includes(CLAUDEKIT_CLI_NPM_PACKAGE_NAME);
			}
		},
	};
}

/**
 * Get version command for npm
 */
export function getNpmVersionCommand(): string {
	return isWindows() ? "npm.cmd --version" : "npm --version";
}

/**
 * Get npm version
 */
export async function getNpmVersion(): Promise<string | null> {
	try {
		const { stdout } = await execAsync(getNpmVersionCommand(), {
			timeout: getPmVersionCommandTimeoutMs(),
		});
		return stdout.trim();
	} catch {
		return null;
	}
}

/**
 * Check if npm is available
 */
export async function isNpmAvailable(): Promise<boolean> {
	try {
		await execAsync(getNpmVersionCommand(), { timeout: getPmVersionCommandTimeoutMs() });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the user's configured npm registry URL.
 * Returns null if detection fails (falls back to npm default).
 */
export async function getNpmRegistryUrl(): Promise<string | null> {
	try {
		const cmd = isWindows() ? "npm.cmd config get registry" : "npm config get registry";
		const { stdout } = await execAsync(cmd, { timeout: getPmVersionCommandTimeoutMs() });
		const url = stdout.trim();
		if (url?.startsWith("http")) {
			return url.replace(/\/$/, "");
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Get npm update command
 * @param registryUrl - Optional registry URL to ensure install uses same registry as version check
 */
export function getNpmUpdateCommand(
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
	return isWindows()
		? `npm.cmd install -g ${packageName}${versionSuffix}${registryFlag}`
		: `npm install -g ${packageName}${versionSuffix}${registryFlag}`;
}
