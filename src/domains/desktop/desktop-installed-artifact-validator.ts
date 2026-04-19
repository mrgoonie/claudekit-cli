import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { DesktopInstallMetadata } from "@/types/desktop.js";

export async function validateInstalledDesktopArtifact(
	binaryPath: string,
	metadata: DesktopInstallMetadata,
	options: {
		platform?: NodeJS.Platform;
		readFileFn?: typeof readFile;
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
			return infoPlist.includes(metadata.version);
		}
	} catch {
		return false;
	}

	return false;
}
