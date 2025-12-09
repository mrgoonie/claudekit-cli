import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import { readFile } from "fs-extra";
import { z } from "zod";

const ReleaseManifestFileSchema = z.object({
	path: z.string(),
	checksum: z.string().regex(/^[a-f0-9]{64}$/),
	size: z.number(),
});

const ReleaseManifestSchema = z.object({
	version: z.string(),
	generatedAt: z.string(),
	files: z.array(ReleaseManifestFileSchema),
});

export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;
export type ReleaseManifestFile = z.infer<typeof ReleaseManifestFileSchema>;

/**
 * ReleaseManifestLoader - Load and query release manifest from kit assets
 */
export class ReleaseManifestLoader {
	/**
	 * Load release manifest from extracted kit directory
	 * @param extractDir Temporary extraction directory
	 * @returns Parsed release manifest or null if not found
	 */
	static async load(extractDir: string): Promise<ReleaseManifest | null> {
		const manifestPath = join(extractDir, "release-manifest.json");

		try {
			const content = await readFile(manifestPath, "utf-8");
			const parsed = JSON.parse(content);
			return ReleaseManifestSchema.parse(parsed);
		} catch (error) {
			logger.debug(`Release manifest not found or invalid: ${error}`);
			return null;
		}
	}

	/**
	 * Find file in manifest by relative path
	 */
	static findFile(
		manifest: ReleaseManifest,
		relativePath: string,
	): ReleaseManifestFile | undefined {
		return manifest.files.find((f) => f.path === relativePath);
	}
}
