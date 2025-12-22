/**
 * Checking module exports
 */
export { VersionChecker } from "./kit-version-checker.js";
export { CliVersionChecker } from "./cli-version-checker.js";
export {
	displayCliNotification,
	displayKitNotification,
	type DisplayNotificationOptions,
} from "./notification-display.js";
export {
	isUpdateCheckDisabled,
	normalizeVersion,
	type VersionCheckResult,
} from "./version-utils.js";
