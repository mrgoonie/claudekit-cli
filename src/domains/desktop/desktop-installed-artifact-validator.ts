import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { DesktopInstallMetadata } from "@/types/desktop.js";

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAC_BUNDLE_VERSION_PATTERN =
	/<key>\s*CFBundleShortVersionString\s*<\/key>\s*<string>([^<]+)<\/string>/;

export async function readInstalledDesktopArtifactVersion(
	binaryPath: string,
	options: {
		platform?: NodeJS.Platform;
		readFileFn?: (path: string, encoding: "utf8") => Promise<string>;
	} = {},
): Promise<string | null> {
	const platform = options.platform || process.platform;
	if (platform !== "darwin") {
		return null;
	}

	const readFileFn = options.readFileFn || readFile;
	try {
		const infoPlist = await readFileFn(join(binaryPath, "Contents", "Info.plist"), "utf8");
		return infoPlist.match(MAC_BUNDLE_VERSION_PATTERN)?.[1] ?? null;
	} catch {
		return null;
	}
}

export async function validateInstalledDesktopArtifact(
	binaryPath: string,
	metadata: DesktopInstallMetadata,
	options: {
		platform?: NodeJS.Platform;
		readFileFn?: (path: string, encoding: "utf8") => Promise<string>;
		statFn?: typeof stat;
	} = {},
): Promise<boolean> {
	const platform = options.platform || process.platform;
	const readFileFn = options.readFileFn || readFile;
	const statFn = options.statFn || stat;

	try {
		if (platform === "linux" || platform === "win32") {
			const fileStat = await statFn(binaryPath);
			return fileStat.isFile() && fileStat.size === metadata.assetSize;
		}

		if (platform === "darwin") {
			const installedVersion = await readInstalledDesktopArtifactVersion(binaryPath, {
				platform,
				readFileFn,
			});
			if (!installedVersion) {
				return false;
			}
			const versionPattern = new RegExp(`^${escapeRegExp(metadata.version)}$`);
			return versionPattern.test(installedVersion);
		}
	} catch {
		return false;
	}

	return false;
}
