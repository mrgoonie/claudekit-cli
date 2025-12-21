/**
 * Environment checks for platform compatibility
 * Checks: platform detection, home directory, environment variables, global directory access
 */

import { constants, access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { arch, homedir, platform } from "node:os";
import { join, normalize } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";

const IS_WINDOWS = platform() === "win32";

/**
 * Check if we should skip expensive operations (CI without isolated test paths)
 */
export function shouldSkipExpensiveOperations(): boolean {
	// If CK_TEST_HOME is set, we're in an isolated test environment - run the actual tests
	if (process.env.CK_TEST_HOME) {
		return false;
	}
	// Skip in CI or when CI_SAFE_MODE is set (no isolated paths)
	return process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";
}

/**
 * Check platform detection
 */
export async function checkPlatformDetect(): Promise<CheckResult> {
	const os = platform();
	const architecture = arch();
	const wslDistro = process.env.WSL_DISTRO_NAME;

	let message = `${os} (${architecture})`;
	if (wslDistro) message += ` - WSL: ${wslDistro}`;

	return {
		id: "platform-detect",
		name: "Platform",
		group: "platform",
		priority: "standard",
		status: "info",
		message,
		autoFixable: false,
	};
}

/**
 * Check home directory resolution
 */
export async function checkHomeDirResolution(): Promise<CheckResult> {
	const nodeHome = normalize(homedir());
	const envHome = normalize(IS_WINDOWS ? process.env.USERPROFILE || "" : process.env.HOME || "");

	const match = nodeHome === envHome && envHome !== "";

	return {
		id: "home-dir-resolution",
		name: "Home Directory",
		group: "platform",
		priority: "standard",
		status: match ? "pass" : "warn",
		message: match ? nodeHome : `Mismatch: Node=${nodeHome}, Env=${envHome || "not set"}`,
		suggestion: !match ? "homedir() differs from environment. May cause path issues." : undefined,
		autoFixable: false,
	};
}

/**
 * Check environment variable expansion (Windows only)
 */
export async function checkEnvVarExpansion(): Promise<CheckResult> {
	const userProfile = process.env.USERPROFILE;

	if (!userProfile) {
		return {
			id: "env-var-expansion",
			name: "Env Var Expansion",
			group: "platform",
			priority: "standard",
			status: "fail",
			message: "USERPROFILE not set",
			suggestion: "Environment variable USERPROFILE is not set",
			autoFixable: false,
		};
	}

	// Verify the path actually exists
	try {
		await access(userProfile, constants.F_OK);
		return {
			id: "env-var-expansion",
			name: "Env Var Expansion",
			group: "platform",
			priority: "standard",
			status: "pass",
			message: "USERPROFILE expands correctly",
			details: userProfile,
			autoFixable: false,
		};
	} catch {
		return {
			id: "env-var-expansion",
			name: "Env Var Expansion",
			group: "platform",
			priority: "standard",
			status: "fail",
			message: "USERPROFILE path not accessible",
			details: userProfile,
			suggestion: "Check if USERPROFILE directory exists and is accessible",
			autoFixable: false,
		};
	}
}

/**
 * Check global directory access
 */
export async function checkGlobalDirAccess(): Promise<CheckResult> {
	const globalDir = PathResolver.getGlobalKitDir();

	// Skip file system operations in CI to prevent hangs (but not in isolated unit tests)
	if (shouldSkipExpensiveOperations()) {
		return {
			id: "global-dir-access",
			name: "Global Dir Access",
			group: "platform",
			priority: "critical",
			status: "info",
			message: "Skipped in CI/test environment",
			details: globalDir,
			autoFixable: false,
		};
	}

	const testFile = join(globalDir, ".ck-doctor-access-test");

	try {
		// Ensure directory exists
		await mkdir(globalDir, { recursive: true });

		// Test write
		await writeFile(testFile, "test", "utf-8");

		// Test read
		const content = await readFile(testFile, "utf-8");

		// Cleanup
		await unlink(testFile);

		if (content !== "test") throw new Error("Read mismatch");

		return {
			id: "global-dir-access",
			name: "Global Dir Access",
			group: "platform",
			priority: "critical",
			status: "pass",
			message: "Read/write OK",
			details: globalDir,
			autoFixable: false,
		};
	} catch (error) {
		return {
			id: "global-dir-access",
			name: "Global Dir Access",
			group: "platform",
			priority: "critical",
			status: "fail",
			message: `Access denied: ${error instanceof Error ? error.message : "unknown"}`,
			details: globalDir,
			suggestion: "Check file permissions on ~/.claude/ directory",
			autoFixable: false,
		};
	}
}
