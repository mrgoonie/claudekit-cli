/**
 * Version Checker Facade
 * Re-exports version checking functionality for Kit and CLI updates.
 */

// Re-export utility functions
export {
	isNewerVersion,
	isUpdateCheckDisabled,
	normalizeVersion,
} from "./checking/version-utils.js";

// Re-export VersionChecker class with displayNotification method preserved for backwards compatibility
export { VersionChecker as VersionCheckerBase } from "./checking/kit-version-checker.js";
export { CliVersionChecker as CliVersionCheckerBase } from "./checking/cli-version-checker.js";
export {
	displayCliNotification,
	displayKitNotification,
	type DisplayNotificationOptions,
} from "./checking/notification-display.js";
export type { VersionCheckResult } from "./checking/version-utils.js";

import { CliVersionChecker as BaseCliVersionChecker } from "./checking/cli-version-checker.js";
// Import for backwards-compatible class wrappers
import { VersionChecker as BaseVersionChecker } from "./checking/kit-version-checker.js";
import {
	type DisplayNotificationOptions,
	displayCliNotification,
	displayKitNotification,
} from "./checking/notification-display.js";
import type { VersionCheckResult } from "./checking/version-utils.js";

/**
 * VersionChecker - Check for Kit updates
 * Maintains backwards compatibility with static displayNotification method
 */
export class VersionChecker {
	/**
	 * Check for updates (non-blocking)
	 * Uses cache if available and valid, otherwise fetches from GitHub
	 */
	static async check(currentVersion: string): Promise<VersionCheckResult | null> {
		return BaseVersionChecker.check(currentVersion);
	}

	/**
	 * Display update notification (styled box with colors)
	 * @param result - Version check result
	 * @param options - Display options (isGlobal affects command shown)
	 */
	static displayNotification(
		result: VersionCheckResult,
		options: DisplayNotificationOptions = {},
	): void {
		displayKitNotification(result, options);
	}
}

/**
 * CliVersionChecker - Check for CLI updates
 * Maintains backwards compatibility with static displayNotification method
 */
export class CliVersionChecker {
	/**
	 * Check for CLI updates from npm registry (non-blocking)
	 * @param currentVersion - Current CLI version
	 * @returns Version check result or null on failure
	 */
	static async check(currentVersion: string): Promise<VersionCheckResult | null> {
		return BaseCliVersionChecker.check(currentVersion);
	}

	/**
	 * Display CLI update notification (styled box with colors)
	 */
	static displayNotification(result: VersionCheckResult): void {
		displayCliNotification(result);
	}
}
