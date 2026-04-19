import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { DesktopInstallMetadata } from "@/types/desktop.js";

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
			const infoPlist = await readFileFn(join(binaryPath, "Contents", "Info.plist"), "utf8");
			const versionPattern = new RegExp(
				`<key>\\s*CFBundleShortVersionString\\s*</key>\\s*<string>${escapeRegExp(metadata.version)}</string>`,
			);
			return versionPattern.test(infoPlist);
		}
	} catch {
		return false;
	}

	return false;
}
