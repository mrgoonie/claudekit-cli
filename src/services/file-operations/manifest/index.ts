// Re-export all manifest modules
export {
	readManifest,
	readKitManifest,
	getUninstallManifest,
	type UninstallManifestResult,
} from "./manifest-reader.js";

export {
	ManifestTracker,
	type BatchTrackOptions,
	type BatchTrackResult,
	type FileTrackInfo,
} from "./manifest-tracker.js";

export { writeManifest, removeKitFromManifest } from "./manifest-updater.js";
