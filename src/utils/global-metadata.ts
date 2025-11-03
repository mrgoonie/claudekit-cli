import { join } from "node:path";
import { pathExists, readFile, writeFile } from "fs-extra";
import type { KitConfig } from "../types.js";
import { getGlobalInstallDir } from "./global-paths.js";

export interface GlobalMetadata {
	version: string;
	kit: KitConfig;
	installDate: string;
	lastUpdateDate: string;
	platform: string;
	arch: string;
}

export async function readGlobalMetadata(): Promise<GlobalMetadata | null> {
	try {
		const metadataPath = join(getGlobalInstallDir(), "metadata.json");

		if (!(await pathExists(metadataPath))) {
			return null;
		}

		const metadataContent = await readFile(metadataPath, "utf8");
		const metadata = JSON.parse(metadataContent) as GlobalMetadata;

		return metadata;
	} catch {
		return null;
	}
}

export async function writeGlobalMetadata(metadata: GlobalMetadata): Promise<void> {
	try {
		const metadataPath = join(getGlobalInstallDir(), "metadata.json");

		await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
	} catch (error) {
		throw new Error(
			`Failed to write global metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

export async function updateGlobalMetadata(version: string, kit: KitConfig): Promise<void> {
	const metadata: GlobalMetadata = {
		version,
		kit,
		installDate: new Date().toISOString(),
		lastUpdateDate: new Date().toISOString(),
		platform: process.platform,
		arch: process.arch,
	};

	await writeGlobalMetadata(metadata);
}
