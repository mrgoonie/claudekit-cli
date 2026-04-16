import type {
	DesktopPlatformAsset,
	DesktopPlatformKey,
	DesktopReleaseManifest,
} from "@/types/desktop.js";

export function getCurrentDesktopPlatformKey(
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch,
): DesktopPlatformKey {
	if (platform === "darwin" && arch === "arm64") return "darwin-aarch64";
	if (platform === "darwin" && arch === "x64") return "darwin-x86_64";
	if (platform === "linux" && arch === "x64") return "linux-x86_64";
	if (platform === "win32" && arch === "x64") return "windows-x86_64";
	throw new Error(`Unsupported desktop platform: ${platform}/${arch}`);
}

export function selectDesktopPlatformEntry(
	manifest: DesktopReleaseManifest,
	options: { platform?: NodeJS.Platform; arch?: string } = {},
): DesktopPlatformAsset {
	const key = getCurrentDesktopPlatformKey(options.platform, options.arch);
	const entry = manifest.platforms[key];
	if (!entry) {
		throw new Error(`Desktop release manifest is missing platform entry: ${key}`);
	}
	return entry;
}
