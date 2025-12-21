/**
 * Platform Checker - Facade
 *
 * Checks platform compatibility including OS detection, home directory,
 * environment variables, shell detection, and Windows-specific features.
 */

import { platform } from "node:os";
import {
	checkEnvVarExpansion,
	checkGlobalDirAccess,
	checkHomeDirResolution,
	checkPlatformDetect,
} from "./platform/environment-checker.js";
import { checkShellDetection, checkWSLBoundary } from "./platform/shell-checker.js";
import { checkLongPathSupport, checkSymlinkSupport } from "./platform/windows-checker.js";
import type { CheckResult, Checker } from "./types.js";

const IS_WINDOWS = platform() === "win32";

export class PlatformChecker implements Checker {
	readonly group = "platform" as const;

	async run(): Promise<CheckResult[]> {
		const results: CheckResult[] = [];

		results.push(await checkPlatformDetect());
		results.push(await checkHomeDirResolution());

		if (IS_WINDOWS) {
			results.push(await checkEnvVarExpansion());
		}

		results.push(await checkGlobalDirAccess());
		results.push(await checkShellDetection());

		if (this.isWSL()) {
			results.push(await checkWSLBoundary());
		}

		if (IS_WINDOWS) {
			results.push(await checkLongPathSupport());
			results.push(await checkSymlinkSupport());
		}

		return results;
	}

	private isWSL(): boolean {
		return !!process.env.WSL_DISTRO_NAME || process.env.WSLENV !== undefined;
	}
}
