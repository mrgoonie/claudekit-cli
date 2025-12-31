import { stat } from "node:fs/promises";
import type { ReleaseManifest, ReleaseManifestFile } from "@/domains/migration/release-manifest.js";
import { findFileInInstalledKits } from "@/services/file-operations/manifest/manifest-reader.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";
import type { KitType } from "@/types";
import semver from "semver";

/**
 * Conflict resolution info for summary reporting
 */
export interface FileConflictInfo {
	relativePath: string;
	incomingKit: string;
	existingKit: string;
	incomingTimestamp: string | null;
	existingTimestamp: string | null;
	winner: "incoming" | "existing";
	reason: "newer" | "existing-newer" | "tie" | "no-timestamps";
}

/**
 * Result of comparing source and destination files
 */
export interface CompareResult {
	changed: boolean;
	reason:
		| "new"
		| "size-differ"
		| "checksum-differ"
		| "unchanged"
		| "shared-identical"
		| "shared-older"
		| "shared-newer";
	sourceChecksum?: string;
	destChecksum?: string;
	sharedWithKit?: KitType; // indicates file is shared with another kit
	conflictInfo?: FileConflictInfo; // for summary reporting
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
	private claudeDir: string | null = null;
	private installingKit: KitType | null = null;

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
	 * Enable multi-kit file checking
	 * @param claudeDir - Path to .claude directory for reading installed metadata
	 * @param installingKit - The kit currently being installed (excluded from search)
	 */
	setMultiKitContext(claudeDir: string, installingKit: KitType): void {
		this.claudeDir = claudeDir;
		this.installingKit = installingKit;
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
			// Destination doesn't exist → check if tracked by another kit but missing on disk
			if (this.claudeDir && this.installingKit) {
				const installed = await findFileInInstalledKits(
					this.claudeDir,
					relativePath,
					this.installingKit,
				);
				if (installed.exists) {
					// File tracked by another kit but missing on disk - corrupted state, copy anyway
					logger.debug(`File ${relativePath} tracked by ${installed.ownerKit} but missing on disk`);
				}
			}
			return { changed: true, reason: "new" };
		}

		// Get source info from manifest
		const manifestEntry = this.manifestMap.get(relativePath);
		if (!manifestEntry) {
			// No manifest entry → can't compare, must copy
			logger.debug(`No manifest entry for ${relativePath}, will copy`);
			return { changed: true, reason: "new" };
		}

		// === Multi-kit file check ===
		if (this.claudeDir && this.installingKit) {
			const installed = await findFileInInstalledKits(
				this.claudeDir,
				relativePath,
				this.installingKit,
			);

			if (installed.exists && installed.checksum && installed.ownerKit) {
				// File exists in another kit's metadata
				if (installed.checksum === manifestEntry.checksum) {
					// Identical file - skip copy, it's already the right version
					logger.debug(`Shared identical: ${relativePath} (owned by ${installed.ownerKit})`);
					return {
						changed: false,
						reason: "shared-identical",
						sourceChecksum: manifestEntry.checksum,
						destChecksum: installed.checksum,
						sharedWithKit: installed.ownerKit,
					};
				}

				// Different checksums - compare timestamps (primary) or versions (fallback)
				const incomingTimestamp = manifestEntry.lastModified ?? null;
				const existingTimestamp = installed.sourceTimestamp;

				const conflictBase: Omit<FileConflictInfo, "winner" | "reason"> = {
					relativePath,
					incomingKit: this.installingKit,
					existingKit: installed.ownerKit,
					incomingTimestamp,
					existingTimestamp,
				};

				// Timestamp-based resolution (primary strategy)
				if (incomingTimestamp && existingTimestamp) {
					const incomingTime = new Date(incomingTimestamp).getTime();
					const existingTime = new Date(existingTimestamp).getTime();

					// Validate timestamps
					if (Number.isNaN(incomingTime) || Number.isNaN(existingTime)) {
						logger.debug(`Invalid timestamp for ${relativePath}, falling back to version`);
					} else if (incomingTime > existingTime) {
						// Incoming is newer - update, return with conflictInfo
						logger.debug(
							`Shared newer: ${relativePath} - incoming ${incomingTimestamp} > existing ${existingTimestamp}`,
						);
						return {
							changed: true,
							reason: "shared-newer",
							sourceChecksum: manifestEntry.checksum,
							destChecksum: installed.checksum,
							sharedWithKit: installed.ownerKit,
							conflictInfo: { ...conflictBase, winner: "incoming", reason: "newer" },
						};
					} else if (incomingTime < existingTime) {
						// Existing is newer - keep existing
						logger.debug(
							`Shared older: ${relativePath} - incoming ${incomingTimestamp} < existing ${existingTimestamp}`,
						);
						return {
							changed: false,
							reason: "shared-older",
							sourceChecksum: manifestEntry.checksum,
							destChecksum: installed.checksum,
							sharedWithKit: installed.ownerKit,
							conflictInfo: { ...conflictBase, winner: "existing", reason: "existing-newer" },
						};
					} else {
						// Same timestamp - tie, first installed wins
						logger.debug(`Shared tie: ${relativePath} - same timestamp, keeping existing`);
						return {
							changed: false,
							reason: "shared-older",
							sourceChecksum: manifestEntry.checksum,
							destChecksum: installed.checksum,
							sharedWithKit: installed.ownerKit,
							conflictInfo: { ...conflictBase, winner: "existing", reason: "tie" },
						};
					}
				} else if (installed.version) {
					// Fallback: version comparison when timestamps unavailable
					const incomingVersion = this.manifest?.version || "0.0.0";
					const installedVersion = installed.version;

					const incomingSemver = semver.coerce(incomingVersion);
					const installedSemver = semver.coerce(installedVersion);

					if (incomingSemver && installedSemver) {
						if (semver.lte(incomingSemver, installedSemver)) {
							logger.debug(
								`Shared older (version fallback): ${relativePath} - incoming ${incomingVersion} <= installed ${installedVersion}`,
							);
							return {
								changed: false,
								reason: "shared-older",
								sourceChecksum: manifestEntry.checksum,
								destChecksum: installed.checksum,
								sharedWithKit: installed.ownerKit,
								conflictInfo: { ...conflictBase, winner: "existing", reason: "no-timestamps" },
							};
						}
					}
					logger.debug(
						`Updating shared file (version fallback): ${relativePath} - incoming ${incomingVersion} > installed ${installedVersion}`,
					);
					return {
						changed: true,
						reason: "shared-newer",
						sourceChecksum: manifestEntry.checksum,
						destChecksum: installed.checksum,
						sharedWithKit: installed.ownerKit,
						conflictInfo: { ...conflictBase, winner: "incoming", reason: "no-timestamps" },
					};
				}
			}
		}

		// === Original comparison logic ===

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
