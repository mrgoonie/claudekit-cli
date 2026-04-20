export {
	buildDesktopReleaseManifest,
	parseDesktopReleaseManifest,
} from "./desktop-release-manifest.js";
export {
	getCurrentDesktopPlatformKey,
	selectDesktopPlatformEntry,
} from "./desktop-asset-selector.js";
export {
	getDesktopDownloadDirectory,
	getDesktopInstallDirectory,
	getDesktopInstallPath,
	getDesktopInstallMetadataPath,
} from "./desktop-install-path-resolver.js";
export { buildDesktopLaunchCommand, launchDesktopApp } from "./desktop-app-launcher.js";
export { fetchDesktopReleaseManifest, getDesktopManifestUrl } from "./desktop-release-service.js";
export {
	downloadDesktopBinary,
	getDesktopInstallHealth,
	getDesktopUpdateStatus,
	getDesktopBinaryPath,
	installDesktopBinary,
} from "./desktop-binary-manager.js";
export {
	clearDesktopInstallMetadata,
	readDesktopInstallMetadata,
} from "./desktop-install-metadata.js";
export { uninstallDesktopBinary } from "./desktop-uninstaller.js";
