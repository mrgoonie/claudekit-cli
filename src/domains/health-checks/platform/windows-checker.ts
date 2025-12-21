/**
 * Windows-specific checks
 * Checks: long path support, symlink support
 */

import { mkdir, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";
import { shouldSkipExpensiveOperations } from "./environment-checker.js";

/**
 * Check long path support (Windows only)
 */
export async function checkLongPathSupport(): Promise<CheckResult> {
	// Skip registry operations in CI/test to prevent hangs on Windows
	if (shouldSkipExpensiveOperations()) {
		return {
			id: "long-path-support",
			name: "Long Path Support",
			group: "platform",
			priority: "extended",
			status: "info",
			message: "Skipped in CI/test environment",
			autoFixable: false,
		};
	}

	try {
		const { execSync } = await import("node:child_process");
		const result = execSync(
			'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled',
			{ encoding: "utf-8", timeout: 2000 },
		);

		const enabled = result.includes("0x1");

		return {
			id: "long-path-support",
			name: "Long Path Support",
			group: "platform",
			priority: "extended",
			status: enabled ? "pass" : "warn",
			message: enabled ? "Enabled" : "Disabled (260 char limit)",
			suggestion: !enabled
				? 'Enable long paths: run as admin: reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f'
				: undefined,
			autoFixable: false,
		};
	} catch {
		return {
			id: "long-path-support",
			name: "Long Path Support",
			group: "platform",
			priority: "extended",
			status: "info",
			message: "Could not determine (requires admin)",
			autoFixable: false,
		};
	}
}

/**
 * Check symlink support (Windows only)
 */
export async function checkSymlinkSupport(): Promise<CheckResult> {
	// Skip symlink operations in CI/test to prevent hangs on Windows
	if (shouldSkipExpensiveOperations()) {
		return {
			id: "symlink-support",
			name: "Symlink Support",
			group: "platform",
			priority: "extended",
			status: "info",
			message: "Skipped in CI/test environment",
			autoFixable: false,
		};
	}

	const testDir = PathResolver.getGlobalKitDir();
	const target = join(testDir, ".ck-symlink-test-target");
	const link = join(testDir, ".ck-symlink-test-link");

	try {
		// Ensure directory exists
		await mkdir(testDir, { recursive: true });

		await writeFile(target, "test", "utf-8");
		await symlink(target, link);
		await unlink(link);
		await unlink(target);

		return {
			id: "symlink-support",
			name: "Symlink Support",
			group: "platform",
			priority: "extended",
			status: "pass",
			message: "Symlinks work",
			autoFixable: false,
		};
	} catch (error) {
		// Cleanup on error
		try {
			await unlink(link).catch(() => {});
			await unlink(target).catch(() => {});
		} catch {}

		return {
			id: "symlink-support",
			name: "Symlink Support",
			group: "platform",
			priority: "extended",
			status: "warn",
			message: "Symlinks not available",
			suggestion: "Enable Developer Mode or run as admin for symlink support",
			details: error instanceof Error ? error.message : "unknown error",
			autoFixable: false,
		};
	}
}
