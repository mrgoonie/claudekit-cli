import { existsSync } from "node:fs";
import { launchDesktopApp } from "@/domains/desktop/desktop-app-launcher.js";
import { selectDesktopPlatformEntry } from "@/domains/desktop/desktop-asset-selector.js";
import {
	getDesktopDownloadDirectory,
	getDesktopInstallPath,
} from "@/domains/desktop/desktop-install-path-resolver.js";
import { installDesktopBinary } from "@/domains/desktop/desktop-installer.js";
import {
	type DesktopChannel,
	fetchDesktopReleaseManifest,
} from "@/domains/desktop/desktop-release-service.js";
import { FileDownloader } from "@/domains/installation/download/file-downloader.js";

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
	} = {},
): Promise<string> {
	const fetchManifest = options.fetchManifest || fetchDesktopReleaseManifest;
	const manifest = await fetchManifest({ version, channel: options.channel });
	const entry = selectDesktopPlatformEntry(manifest, {
		platform: options.platform,
		arch: options.arch,
	});
	const downloadFile =
		options.downloadFile || ((params) => new FileDownloader().downloadFile(params));
	const getDownloadDirectory = options.getDownloadDirectory || getDesktopDownloadDirectory;

	return downloadFile({
		url: entry.url,
		name: entry.name,
		size: entry.size,
		destDir: getDownloadDirectory(),
	});
}

export { installDesktopBinary, launchDesktopApp };
