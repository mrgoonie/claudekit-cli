/**
 * ManifestWriter - Facade for manifest operations
 *
 * This module is split into:
 * - manifest/manifest-reader.ts: readManifest, readKitManifest, getUninstallManifest
 * - manifest/manifest-tracker.ts: ManifestTracker class for file tracking
 * - manifest/manifest-updater.ts: writeManifest, removeKitFromManifest
 */

import type { FileOwnership, KitMetadata, KitType, Metadata, TrackedFile } from "@/types";
import {
	type BatchTrackOptions,
	type BatchTrackResult,
	type FileTrackInfo,
	ManifestTracker,
	type UninstallManifestResult,
	getUninstallManifest,
	readKitManifest,
	readManifest,
	removeKitFromManifest,
	writeManifest,
} from "./manifest/index.js";

// Re-export types for backward compatibility
export type { BatchTrackOptions, BatchTrackResult, FileTrackInfo, UninstallManifestResult };

/**
 * ManifestWriter handles reading and writing installation manifests to metadata.json
 * This tracks exactly what files ClaudeKit installed for accurate uninstall
 */
export class ManifestWriter {
	private tracker = new ManifestTracker();

	/**
	 * Add a file or directory to the installed files manifest
	 */
	addInstalledFile(relativePath: string): void {
		this.tracker.addInstalledFile(relativePath);
	}

	/**
	 * Add multiple files/directories to the manifest
	 */
	addInstalledFiles(relativePaths: string[]): void {
		this.tracker.addInstalledFiles(relativePaths);
	}

	/**
	 * Mark a file as user config (should be preserved during uninstall)
	 */
	addUserConfigFile(relativePath: string): void {
		this.tracker.addUserConfigFile(relativePath);
	}

	/**
	 * Get list of installed files
	 */
	getInstalledFiles(): string[] {
		return this.tracker.getInstalledFiles();
	}

	/**
	 * Get list of user config files
	 */
	getUserConfigFiles(): string[] {
		return this.tracker.getUserConfigFiles();
	}

	/**
	 * Add a tracked file with checksum and ownership
	 */
	async addTrackedFile(
		filePath: string,
		relativePath: string,
		ownership: FileOwnership,
		installedVersion: string,
	): Promise<void> {
		return this.tracker.addTrackedFile(filePath, relativePath, ownership, installedVersion);
	}

	/**
	 * Add multiple tracked files in parallel with progress reporting
	 */
	async addTrackedFilesBatch(
		files: FileTrackInfo[],
		options: BatchTrackOptions = {},
	): Promise<BatchTrackResult> {
		return this.tracker.addTrackedFilesBatch(files, options);
	}

	/**
	 * Get tracked files as array sorted by path
	 */
	getTrackedFiles(): TrackedFile[] {
		return this.tracker.getTrackedFiles();
	}

	/**
	 * Write or update metadata.json with installation manifest (multi-kit aware)
	 */
	async writeManifest(
		claudeDir: string,
		kitName: string,
		version: string,
		scope: "local" | "global",
		kitType?: KitType,
	): Promise<void> {
		return writeManifest(
			claudeDir,
			kitName,
			version,
			scope,
			kitType,
			this.getTrackedFiles(),
			this.getUserConfigFiles(),
		);
	}

	/**
	 * Read manifest from existing metadata.json
	 */
	static async readManifest(claudeDir: string): Promise<Metadata | null> {
		return readManifest(claudeDir);
	}

	/**
	 * Read kit-specific manifest from metadata.json
	 */
	static async readKitManifest(claudeDir: string, kit: KitType): Promise<KitMetadata | null> {
		return readKitManifest(claudeDir, kit);
	}

	/**
	 * Get files to remove during uninstall based on manifest (multi-kit aware)
	 */
	static async getUninstallManifest(
		claudeDir: string,
		kit?: KitType,
	): Promise<UninstallManifestResult> {
		return getUninstallManifest(claudeDir, kit);
	}

	/**
	 * Remove a kit from metadata.json (for kit-scoped uninstall)
	 */
	static async removeKitFromManifest(claudeDir: string, kit: KitType): Promise<boolean> {
		return removeKitFromManifest(claudeDir, kit);
	}
}
