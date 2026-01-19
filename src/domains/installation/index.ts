/**
 * Installation domain - download, merge, and installation management
 */

export { DownloadManager } from "./download-manager.js";
export { FileMerger } from "./file-merger.js";
export { PackageManagerDetector } from "./package-manager-detector.js";
export { handleFreshInstallation } from "./fresh-installer.js";
export {
	runSetupWizard,
	checkRequiredKeysExist,
	REQUIRED_ENV_KEYS,
	type RequiredEnvKey,
	type RequiredKeysCheckResult,
} from "./setup-wizard.js";
export {
	downloadAndExtract,
	type DownloadExtractOptions,
	type DownloadExtractResult,
} from "./download-extractor.js";
export { SelectiveMerger, type FileConflictInfo, type CompareResult } from "./selective-merger.js";
export * from "./types.js";
