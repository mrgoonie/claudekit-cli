import { isWindows } from "@/shared/environment.js";
import type { PmQuery } from "./detector-base.js";
import { execAsync, isValidPackageName, isValidVersion } from "./detector-base.js";

/**
 * Get NPM query configuration
 */
export function getNpmQuery(): PmQuery {
	return {
		pm: "npm",
		cmd: isWindows()
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
		const { stdout } = await execAsync(getNpmVersionCommand(), { timeout: 3000 });
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
		await execAsync(getNpmVersionCommand(), { timeout: 3000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get npm update command
 */
export function getNpmUpdateCommand(packageName: string, version?: string): string {
	if (!isValidPackageName(packageName)) {
		throw new Error(`Invalid package name: ${packageName}`);
	}
	if (version && !isValidVersion(version)) {
		throw new Error(`Invalid version: ${version}`);
	}

	const versionSuffix = version ? `@${version}` : "@latest";
	return isWindows()
		? `npm.cmd install -g ${packageName}${versionSuffix}`
		: `npm install -g ${packageName}${versionSuffix}`;
}
