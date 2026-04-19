import type { GitHubReleaseAsset } from "@/types";
import { type DesktopReleaseManifest, DesktopReleaseManifestSchema } from "@/types/desktop.js";

function findAsset(
	assets: GitHubReleaseAsset[],
	pattern: RegExp,
	label: string,
): GitHubReleaseAsset {
	const asset = assets.find((entry) => pattern.test(entry.name));
	if (!asset) {
		throw new Error(`Missing required desktop release asset for ${label}`);
	}
	return asset;
}

export function parseDesktopReleaseManifest(input: unknown): DesktopReleaseManifest {
	return DesktopReleaseManifestSchema.parse(input);
}

export function buildDesktopReleaseManifest(input: {
	version: string;
	publishedAt: string;
	assets: GitHubReleaseAsset[];
	channel?: "stable" | "dev";
}): DesktopReleaseManifest {
	const macAsset = findAsset(input.assets, /macos-universal\.app\.zip$/i, "macOS");
	const linuxAsset = findAsset(input.assets, /linux-x86_64\.AppImage$/i, "Linux");
	const windowsAsset = findAsset(input.assets, /windows-x86_64-portable\.exe$/i, "Windows");

	return parseDesktopReleaseManifest({
		version: input.version,
		date: input.publishedAt,
		channel: input.channel ?? "stable",
		platforms: {
			"darwin-aarch64": {
				name: macAsset.name,
				url: macAsset.browser_download_url,
				size: macAsset.size,
				assetType: "app-zip",
			},
			"darwin-x86_64": {
				name: macAsset.name,
				url: macAsset.browser_download_url,
				size: macAsset.size,
				assetType: "app-zip",
			},
			"linux-x86_64": {
				name: linuxAsset.name,
				url: linuxAsset.browser_download_url,
				size: linuxAsset.size,
				assetType: "appimage",
			},
			"windows-x86_64": {
				name: windowsAsset.name,
				url: windowsAsset.browser_download_url,
				size: windowsAsset.size,
				assetType: "portable-exe",
			},
		},
	});
}
