import { existsSync } from "node:fs";
import { launchDesktopApp } from "@/domains/desktop/desktop-app-launcher.js";
import {
	getCurrentDesktopPlatformKey,
	selectDesktopPlatformEntry,
} from "@/domains/desktop/desktop-asset-selector.js";
import {
	readDesktopInstallMetadata,
	writeDownloadedDesktopMetadata,
} from "@/domains/desktop/desktop-install-metadata.js";
import {
	getDesktopDownloadDirectory,
	getDesktopInstallPath,
} from "@/domains/desktop/desktop-install-path-resolver.js";
import {
	readInstalledDesktopArtifactVersion,
	validateInstalledDesktopArtifact,
} from "@/domains/desktop/desktop-installed-artifact-validator.js";
import { installDesktopBinary } from "@/domains/desktop/desktop-installer.js";
import {
	type DesktopChannel,
	fetchDesktopReleaseManifest,
} from "@/domains/desktop/desktop-release-service.js";
import { FileDownloader } from "@/domains/installation/download/file-downloader.js";
import {
	isNewerVersion,
	normalizeVersion,
	versionsMatch,
} from "@/domains/versioning/checking/version-utils.js";
import type { DesktopInstallMetadata } from "@/types/desktop.js";

export function getDesktopBinaryPath(
	options: {
		platform?: NodeJS.Platform;
		existsFn?: (path: string) => boolean;
	} = {},
): string | null {
	const installPath = getDesktopInstallPath({ platform: options.platform });
	const existsFn = options.existsFn || existsSync;
	return existsFn(installPath) ? installPath : null;
}

function resolveDesktopMetadata(
	manifestVersion: string,
	manifestDate: string,
	channel: DesktopChannel,
	platformKey: ReturnType<typeof getCurrentDesktopPlatformKey>,
	entry: { name: string; size: number },
): DesktopInstallMetadata {
	return {
		version: normalizeVersion(manifestVersion),
		manifestDate,
		channel,
		platformKey,
		assetName: entry.name,
		assetSize: entry.size,
		installedAt: new Date().toISOString(),
	};
}

async function resolveDesktopReleaseAsset(
	version: string | undefined,
	options: {
		channel?: DesktopChannel;
		platform?: NodeJS.Platform;
		arch?: string;
		fetchManifest?: typeof fetchDesktopReleaseManifest;
	},
) {
	const fetchManifest = options.fetchManifest || fetchDesktopReleaseManifest;
	const manifest = await fetchManifest({ version, channel: options.channel });
	const entry = selectDesktopPlatformEntry(manifest, {
		platform: options.platform,
		arch: options.arch,
	});
	const platformKey = getCurrentDesktopPlatformKey(options.platform, options.arch);
	return {
		manifest,
		entry,
		platformKey,
	};
}

export interface DesktopUpdateStatus {
	currentVersion: string | null;
	latestVersion: string;
	updateAvailable: boolean;
	reason:
		| "up-to-date"
		| "update-available"
		| "installed-newer"
		| "unknown-installed-version"
		| "missing-binary";
}

export interface DesktopInstallHealth {
	currentVersion: string | null;
	healthy: boolean;
	reason: "healthy" | "missing-metadata" | "missing-binary" | "artifact-invalid";
}

export async function getDesktopInstallHealth(
	options: {
		platform?: NodeJS.Platform;
		readInstallMetadata?: typeof readDesktopInstallMetadata;
		binaryPath?: string | null;
		validateInstalledArtifact?: typeof validateInstalledDesktopArtifact;
		readInstalledArtifactVersion?: typeof readInstalledDesktopArtifactVersion;
	} = {},
): Promise<DesktopInstallHealth> {
	const readInstallMetadata = options.readInstallMetadata || readDesktopInstallMetadata;
	const validateInstalledArtifact =
		options.validateInstalledArtifact || validateInstalledDesktopArtifact;
	const readInstalledArtifactVersion =
		options.readInstalledArtifactVersion || readInstalledDesktopArtifactVersion;
	const installed = await readInstallMetadata({ platform: options.platform });

	if (!installed) {
		return {
			currentVersion: null,
			healthy: false,
			reason: "missing-metadata",
		};
	}

	const binaryPath = options.binaryPath || getDesktopBinaryPath({ platform: options.platform });
	if (!binaryPath) {
		return {
			currentVersion: installed.version,
			healthy: false,
			reason: "missing-binary",
		};
	}

	if (!(await validateInstalledArtifact(binaryPath, installed, { platform: options.platform }))) {
		const installedArtifactVersion = await readInstalledArtifactVersion(binaryPath, {
			platform: options.platform,
		});
		return {
			currentVersion: installedArtifactVersion || installed.version,
			healthy: false,
			reason: "artifact-invalid",
		};
	}

	return {
		currentVersion: installed.version,
		healthy: true,
		reason: "healthy",
	};
}

export async function getDesktopUpdateStatus(
	options: {
		channel?: DesktopChannel;
		platform?: NodeJS.Platform;
		arch?: string;
		fetchManifest?: typeof fetchDesktopReleaseManifest;
		readInstallMetadata?: typeof readDesktopInstallMetadata;
		binaryPath?: string | null;
		validateInstalledArtifact?: typeof validateInstalledDesktopArtifact;
		readInstalledArtifactVersion?: typeof readInstalledDesktopArtifactVersion;
	} = {},
): Promise<DesktopUpdateStatus> {
	const { manifest, entry, platformKey } = await resolveDesktopReleaseAsset(undefined, options);
	const latestVersion = normalizeVersion(manifest.version);
	const readInstallMetadata = options.readInstallMetadata || readDesktopInstallMetadata;
	const validateInstalledArtifact =
		options.validateInstalledArtifact || validateInstalledDesktopArtifact;
	const readInstalledArtifactVersion =
		options.readInstalledArtifactVersion || readInstalledDesktopArtifactVersion;
	const installed = await readInstallMetadata({ platform: options.platform });
	const requestedChannel = options.channel ?? "stable";

	if (!installed) {
		return {
			currentVersion: null,
			latestVersion,
			updateAvailable: true,
			reason: "unknown-installed-version",
		};
	}

	const binaryPath = options.binaryPath || getDesktopBinaryPath({ platform: options.platform });
	if (!binaryPath) {
		return {
			currentVersion: installed.version,
			latestVersion,
			updateAvailable: true,
			reason: "missing-binary",
		};
	}

	const sameChannel = installed.channel === requestedChannel;
	const samePlatform = installed.platformKey === platformKey;

	if (!(await validateInstalledArtifact(binaryPath, installed, { platform: options.platform }))) {
		const installedArtifactVersion = await readInstalledArtifactVersion(binaryPath, {
			platform: options.platform,
		});
		const currentVersion = installedArtifactVersion || installed.version;
		const installedArtifactIsNewer =
			sameChannel && samePlatform && isNewerVersion(latestVersion, currentVersion);
		if (installedArtifactIsNewer) {
			return {
				currentVersion,
				latestVersion,
				updateAvailable: false,
				reason: "installed-newer",
			};
		}
		return {
			currentVersion,
			latestVersion,
			updateAvailable: true,
			reason: "update-available",
		};
	}

	const metadataMatchesRelease =
		sameChannel &&
		installed.platformKey === platformKey &&
		installed.assetName === entry.name &&
		installed.assetSize === entry.size &&
		installed.manifestDate === manifest.date;
	const installedIsNewer =
		sameChannel && samePlatform && isNewerVersion(latestVersion, installed.version);

	if (installedIsNewer) {
		return {
			currentVersion: installed.version,
			latestVersion,
			updateAvailable: false,
			reason: "installed-newer",
		};
	}

	if (metadataMatchesRelease && versionsMatch(installed.version, latestVersion)) {
		return {
			currentVersion: installed.version,
			latestVersion,
			updateAvailable: false,
			reason: "up-to-date",
		};
	}

	return {
		currentVersion: installed.version,
		latestVersion,
		updateAvailable: true,
		reason: "update-available",
	};
}

export async function downloadDesktopBinary(
	version?: string,
	options: {
		channel?: DesktopChannel;
		platform?: NodeJS.Platform;
		arch?: string;
		fetchManifest?: typeof fetchDesktopReleaseManifest;
		downloadFile?: (params: {
			url: string;
			name: string;
			size?: number;
			destDir: string;
			token?: string;
		}) => Promise<string>;
		getDownloadDirectory?: () => string;
		writeDownloadedMetadata?: (
			downloadPath: string,
			metadata: DesktopInstallMetadata,
		) => Promise<void>;
	} = {},
): Promise<string> {
	const { manifest, entry, platformKey } = await resolveDesktopReleaseAsset(version, options);
	const downloadFile =
		options.downloadFile || ((params) => new FileDownloader().downloadFile(params));
	const getDownloadDirectory = options.getDownloadDirectory || getDesktopDownloadDirectory;
	const writeDownloadedMetadata = options.writeDownloadedMetadata || writeDownloadedDesktopMetadata;

	const downloadPath = await downloadFile({
		url: entry.url,
		name: entry.name,
		size: entry.size,
		destDir: getDownloadDirectory(),
	});
	await writeDownloadedMetadata(
		downloadPath,
		resolveDesktopMetadata(manifest.version, manifest.date, manifest.channel, platformKey, entry),
	);
	return downloadPath;
}

export { installDesktopBinary, launchDesktopApp };
