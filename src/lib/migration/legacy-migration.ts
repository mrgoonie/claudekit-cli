import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { writeFile } from "fs-extra";
import type { Metadata, TrackedFile } from "../../types.js";
import { logger } from "../../utils/logger.js";
import { ManifestWriter } from "../../utils/manifest-writer.js";
import { OwnershipChecker } from "../ownership-checker.js";
import { type ReleaseManifest, ReleaseManifestLoader } from "./release-manifest.js";

export interface LegacyDetectionResult {
	isLegacy: boolean;
	reason: "no-metadata" | "old-format" | "current";
	confidence: "high" | "medium" | "low";
}

export interface MigrationPreview {
	ckPristine: string[]; // CK files unmodified
	ckModified: string[]; // CK files user edited
	userCreated: string[]; // User's custom files
	totalFiles: number;
}

/**
 * LegacyMigration - Migrate legacy installs to ownership tracking system
 */
export class LegacyMigration {
	/**
	 * Detect if installation is legacy (needs migration)
	 */
	static async detectLegacy(claudeDir: string): Promise<LegacyDetectionResult> {
		const metadata = await ManifestWriter.readManifest(claudeDir);

		if (!metadata) {
			return { isLegacy: true, reason: "no-metadata", confidence: "high" };
		}

		if (!metadata.files || metadata.files.length === 0) {
			return { isLegacy: true, reason: "old-format", confidence: "high" };
		}

		return { isLegacy: false, reason: "current", confidence: "high" };
	}

	/**
	 * Scan directory recursively and collect all files
	 */
	static async scanFiles(dir: string): Promise<string[]> {
		const files: string[] = [];

		let entries: string[];
		try {
			entries = await readdir(dir);
		} catch {
			return files;
		}

		for (const entry of entries) {
			// Skip metadata.json itself
			if (entry === "metadata.json") continue;

			const fullPath = join(dir, entry);
			let stats;
			try {
				stats = await stat(fullPath);
			} catch {
				continue;
			}

			if (stats.isDirectory()) {
				files.push(...(await LegacyMigration.scanFiles(fullPath)));
			} else if (stats.isFile()) {
				files.push(fullPath);
			}
		}

		return files;
	}

	/**
	 * Classify files based on release manifest
	 */
	static async classifyFiles(
		claudeDir: string,
		manifest: ReleaseManifest,
	): Promise<MigrationPreview> {
		const files = await LegacyMigration.scanFiles(claudeDir);
		const preview: MigrationPreview = {
			ckPristine: [],
			ckModified: [],
			userCreated: [],
			totalFiles: files.length,
		};

		for (const file of files) {
			const relativePath = relative(claudeDir, file).replace(/\\/g, "/");
			const manifestEntry = ReleaseManifestLoader.findFile(manifest, relativePath);

			if (!manifestEntry) {
				// Not in manifest → user created
				preview.userCreated.push(relativePath);
				continue;
			}

			// In manifest → check if modified
			const actualChecksum = await OwnershipChecker.calculateChecksum(file);
			if (actualChecksum === manifestEntry.checksum) {
				preview.ckPristine.push(relativePath);
			} else {
				preview.ckModified.push(relativePath);
			}
		}

		return preview;
	}

	/**
	 * Perform migration
	 * @param claudeDir Path to .claude directory
	 * @param manifest Release manifest from kit
	 * @param kitName Name of kit being installed
	 * @param kitVersion Version of kit
	 * @param interactive Whether to prompt user (false in CI)
	 * @returns true if migration successful
	 */
	static async migrate(
		claudeDir: string,
		manifest: ReleaseManifest,
		kitName: string,
		kitVersion: string,
		_interactive = true,
	): Promise<boolean> {
		logger.info("Migrating legacy installation to ownership tracking...");

		// Classify files
		const preview = await LegacyMigration.classifyFiles(claudeDir, manifest);

		// Show preview
		logger.info("Migration preview:");
		logger.info(`  CK files (pristine): ${preview.ckPristine.length}`);
		logger.info(`  CK files (modified): ${preview.ckModified.length}`);
		logger.info(`  User files: ${preview.userCreated.length}`);
		logger.info(`  Total: ${preview.totalFiles}`);

		// Sample files
		if (preview.ckModified.length > 0) {
			logger.info("\nModified CK files (sample):");
			preview.ckModified.slice(0, 3).forEach((f) => logger.info(`  - ${f}`));
			if (preview.ckModified.length > 3) {
				logger.info(`  ... and ${preview.ckModified.length - 3} more`);
			}
		}

		if (preview.userCreated.length > 0) {
			logger.info("\nUser-created files (sample):");
			preview.userCreated.slice(0, 3).forEach((f) => logger.info(`  - ${f}`));
			if (preview.userCreated.length > 3) {
				logger.info(`  ... and ${preview.userCreated.length - 3} more`);
			}
		}

		// Create tracked files list
		const trackedFiles: TrackedFile[] = [];

		// Add pristine CK files
		for (const relativePath of preview.ckPristine) {
			const manifestEntry = ReleaseManifestLoader.findFile(manifest, relativePath);
			if (manifestEntry) {
				trackedFiles.push({
					path: relativePath,
					checksum: manifestEntry.checksum,
					ownership: "ck",
					installedVersion: kitVersion,
				});
			}
		}

		// Add modified CK files
		for (const relativePath of preview.ckModified) {
			const fullPath = join(claudeDir, relativePath);
			const actualChecksum = await OwnershipChecker.calculateChecksum(fullPath);
			trackedFiles.push({
				path: relativePath,
				checksum: actualChecksum,
				ownership: "ck-modified",
				installedVersion: kitVersion,
			});
		}

		// Add user files
		for (const relativePath of preview.userCreated) {
			const fullPath = join(claudeDir, relativePath);
			const checksum = await OwnershipChecker.calculateChecksum(fullPath);
			trackedFiles.push({
				path: relativePath,
				checksum,
				ownership: "user",
				installedVersion: kitVersion,
			});
		}

		// Update metadata.json
		const existingMetadata = await ManifestWriter.readManifest(claudeDir);
		const updatedMetadata: Metadata = {
			...existingMetadata,
			name: kitName,
			version: kitVersion,
			installedAt: new Date().toISOString(),
			files: trackedFiles,
		};

		// Write metadata
		const metadataPath = join(claudeDir, "metadata.json");
		await writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));

		logger.success(`Migration complete: tracked ${trackedFiles.length} files`);
		return true;
	}
}
