import { constants, access, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { CheckResult } from "../types.js";
import { shouldSkipExpensiveOperations } from "./shared.js";

/**
 * Check if global directory is readable
 */
export async function checkGlobalDirReadable(): Promise<CheckResult> {
	const globalDir = PathResolver.getGlobalKitDir();

	// Skip file system checks in CI to prevent hangs (but not in isolated unit tests)
	if (shouldSkipExpensiveOperations()) {
		return {
			id: "ck-global-dir-readable",
			name: "Global Dir Readable",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "Skipped in CI/test environment",
			details: globalDir,
			autoFixable: false,
		};
	}

	try {
		// Use access() to check read permission - more efficient than reading file contents
		await access(globalDir, constants.R_OK);

		return {
			id: "ck-global-dir-readable",
			name: "Global Dir Readable",
			group: "claudekit",
			priority: "standard",
			status: "pass",
			message: "Read access OK",
			details: globalDir,
			autoFixable: false,
		};
	} catch (error) {
		return {
			id: "ck-global-dir-readable",
			name: "Global Dir Readable",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Read access denied",
			details: globalDir,
			suggestion: "Check file permissions on ~/.claude/",
			autoFixable: false,
		};
	}
}

/**
 * Check if global directory is writable
 */
export async function checkGlobalDirWritable(): Promise<CheckResult> {
	const globalDir = PathResolver.getGlobalKitDir();

	// Skip file system operations in CI/test to prevent hangs
	if (shouldSkipExpensiveOperations()) {
		return {
			id: "ck-global-dir-writable",
			name: "Global Dir Writable",
			group: "claudekit",
			priority: "standard",
			status: "info",
			message: "Skipped in CI/test environment",
			details: globalDir,
			autoFixable: false,
		};
	}

	// Generate unique filename to avoid race conditions
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2);
	const testFile = join(globalDir, `.ck-write-test-${timestamp}-${random}`);

	try {
		// Use atomic writeFile with 'wx' flag to fail if file exists
		// This prevents race conditions between concurrent tests
		await writeFile(testFile, "test", { encoding: "utf-8", flag: "wx" });
	} catch (error) {
		// If write fails, directory is not writable or file already exists
		return {
			id: "ck-global-dir-writable",
			name: "Global Dir Writable",
			group: "claudekit",
			priority: "standard",
			status: "fail",
			message: "Write access denied",
			details: globalDir,
			suggestion: "Check file permissions on ~/.claude/",
			autoFixable: false,
		};
	}

	// Try to clean up the test file, but don't fail if cleanup fails
	try {
		await unlink(testFile);
	} catch (_error) {
		// Cleanup failed, but directory is still writable
		logger.verbose("Failed to cleanup write test file", { testFile });
	}

	// Write succeeded, directory is writable
	return {
		id: "ck-global-dir-writable",
		name: "Global Dir Writable",
		group: "claudekit",
		priority: "standard",
		status: "pass",
		message: "Write access OK",
		details: globalDir,
		autoFixable: false,
	};
}
