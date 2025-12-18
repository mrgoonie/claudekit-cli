import { stat } from "node:fs/promises";
import type { ReleaseManifest, ReleaseManifestFile } from "@/domains/migration/release-manifest.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";

/**
 * Result of comparing source and destination files
 */
export interface CompareResult {
	changed: boolean;
	reason: "new" | "size-differ" | "checksum-differ" | "unchanged";
	sourceChecksum?: string;
	destChecksum?: string;
}

/**
 * SelectiveMerger - Determines which files need to be copied during init/update
 *
 * Uses hybrid size+checksum comparison for efficiency:
 * 1. Fast path: If dest doesn't exist → new file, must copy
 * 2. Fast path: If sizes differ → file changed, must copy
 * 3. Slow path: If sizes match → calculate dest checksum, compare with manifest
 *
 * This significantly reduces I/O for update operations where most files are unchanged.
 * Fresh installs are unaffected (all files are new).
 */
export class SelectiveMerger {
	private manifest: ReleaseManifest | null;
	private manifestMap: Map<string, ReleaseManifestFile>;

	constructor(manifest: ReleaseManifest | null) {
		this.manifest = manifest;
		this.manifestMap = new Map();
		if (manifest) {
			for (const file of manifest.files) {
				this.manifestMap.set(file.path, file);
			}
		}
	}

	/**
	 * Compare source and destination file to determine if copy is needed
	 * Uses hybrid size+checksum comparison for efficiency
	 *
	 * @param destPath Absolute path to destination file
	 * @param relativePath Relative path for manifest lookup (forward slashes)
	 * @returns CompareResult indicating whether file should be copied
	 */
	async shouldCopyFile(destPath: string, relativePath: string): Promise<CompareResult> {
		// Check if destination exists
		let destStat;
		try {
			destStat = await stat(destPath);
		} catch {
			// Destination doesn't exist → new file, must copy
			return { changed: true, reason: "new" };
		}

		// Get source info from manifest
		const manifestEntry = this.manifestMap.get(relativePath);
		if (!manifestEntry) {
			// No manifest entry → can't compare, must copy
			logger.debug(`No manifest entry for ${relativePath}, will copy`);
			return { changed: true, reason: "new" };
		}

		// Fast path: compare sizes first (O(1) stat)
		if (destStat.size !== manifestEntry.size) {
			logger.debug(`Size differs for ${relativePath}: ${destStat.size} vs ${manifestEntry.size}`);
			return {
				changed: true,
				reason: "size-differ",
				sourceChecksum: manifestEntry.checksum,
			};
		}

		// Slow path: sizes match, compare checksums
		const destChecksum = await OwnershipChecker.calculateChecksum(destPath);

		if (destChecksum !== manifestEntry.checksum) {
			logger.debug(`Checksum differs for ${relativePath}`);
			return {
				changed: true,
				reason: "checksum-differ",
				sourceChecksum: manifestEntry.checksum,
				destChecksum,
			};
		}

		// Checksums match → file unchanged
		logger.debug(`Unchanged: ${relativePath}`);
		return {
			changed: false,
			reason: "unchanged",
			sourceChecksum: manifestEntry.checksum,
			destChecksum,
		};
	}

	/**
	 * Check if manifest is available for selective merge
	 */
	hasManifest(): boolean {
		return this.manifest !== null && this.manifestMap.size > 0;
	}

	/**
	 * Get number of files tracked in manifest
	 */
	getManifestFileCount(): number {
		return this.manifestMap.size;
	}
}
