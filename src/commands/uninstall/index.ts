/**
 * Uninstall Command Module
 *
 * Re-exports all public APIs from the uninstall command module.
 */

export { uninstallCommand } from "./uninstall-command.js";
export { detectInstallations, type Installation } from "./installation-detector.js";
export {
	analyzeInstallation,
	cleanupEmptyDirectories,
	displayDryRunPreview,
	type UninstallAnalysis,
} from "./analysis-handler.js";
export { removeInstallations } from "./removal-handler.js";
