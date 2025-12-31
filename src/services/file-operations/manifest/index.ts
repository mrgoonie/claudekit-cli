// Re-export all manifest modules
export {
	readManifest,
	readKitManifest,
	getUninstallManifest,
	findFileInInstalledKits,
	type UninstallManifestResult,
	type InstalledFileInfo,
} from "./manifest-reader.js";

export {
	ManifestTracker,
	type BatchTrackOptions,
	type BatchTrackResult,
	type FileTrackInfo,
	type BuildFileTrackingOptions,
	type WriteManifestOptions,
	buildFileTrackingList,
	trackFilesWithProgress,
} from "./manifest-tracker.js";

export { writeManifest, removeKitFromManifest } from "./manifest-updater.js";
