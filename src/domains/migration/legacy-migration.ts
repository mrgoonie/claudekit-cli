import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";
import type { Metadata, TrackedFile } from "@/types";
import { writeFile } from "fs-extra";
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
	 * @param dir Directory to scan
	 * @returns Array of absolute file paths
	 */
	static async scanFiles(dir: string): Promise<string[]> {
		const files: string[] = [];

		let entries: string[];
		try {
			entries = await readdir(dir);
		} catch (err) {
			const error = err as NodeJS.ErrnoException;
			if (error.code === "ENOENT") {
				logger.debug(`Directory does not exist: ${dir}`);
			} else if (error.code === "EACCES") {
				logger.debug(`Permission denied reading directory: ${dir}`);
			} else {
				logger.debug(`Failed to read directory "${dir}": ${error.message}`);
			}
			return files;
		}

		for (const entry of entries) {
			// Skip metadata.json itself
			if (entry === "metadata.json") continue;

			const fullPath = join(dir, entry);
			let stats;
			try {
				stats = await stat(fullPath);
			} catch (err) {
				const error = err as NodeJS.ErrnoException;
				if (error.code === "ENOENT") {
					logger.debug(`File removed during scan: ${fullPath}`);
				} else if (error.code === "EACCES") {
					logger.debug(`Permission denied accessing: ${fullPath}`);
				} else {
					logger.debug(`Failed to stat "${fullPath}": ${error.message}`);
				}
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
	 * Uses parallel checksum calculation for better performance with large file sets
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

		// Separate files by whether they're in manifest (need checksum) or not
		const filesInManifest: Array<{
			file: string;
			relativePath: string;
			manifestChecksum: string;
		}> = [];

		for (const file of files) {
			const relativePath = relative(claudeDir, file).replace(/\\/g, "/");
			const manifestEntry = ReleaseManifestLoader.findFile(manifest, relativePath);

			if (!manifestEntry) {
				// Not in manifest → user created (no checksum needed)
				preview.userCreated.push(relativePath);
			} else {
				filesInManifest.push({
					file,
					relativePath,
					manifestChecksum: manifestEntry.checksum,
				});
			}
		}

		// Batch calculate checksums in parallel for files in manifest
		if (filesInManifest.length > 0) {
			const checksumResults = await Promise.all(
				filesInManifest.map(async ({ file, relativePath, manifestChecksum }) => {
					const actualChecksum = await OwnershipChecker.calculateChecksum(file);
					return { relativePath, actualChecksum, manifestChecksum };
				}),
			);

			// Classify based on checksum comparison
			for (const { relativePath, actualChecksum, manifestChecksum } of checksumResults) {
				if (actualChecksum === manifestChecksum) {
					preview.ckPristine.push(relativePath);
				} else {
					preview.ckModified.push(relativePath);
				}
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

		// Add pristine CK files (no checksum needed - use manifest)
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

		// Calculate checksums in parallel for modified and user files
		const filesToChecksum = [
			...preview.ckModified.map((p) => ({ relativePath: p, ownership: "ck-modified" as const })),
			...preview.userCreated.map((p) => ({ relativePath: p, ownership: "user" as const })),
		];

		if (filesToChecksum.length > 0) {
			const checksumResults = await Promise.all(
				filesToChecksum.map(async ({ relativePath, ownership }) => {
					const fullPath = join(claudeDir, relativePath);
					const checksum = await OwnershipChecker.calculateChecksum(fullPath);
					return { relativePath, checksum, ownership };
				}),
			);

			for (const { relativePath, checksum, ownership } of checksumResults) {
				trackedFiles.push({
					path: relativePath,
					checksum,
					ownership,
					installedVersion: kitVersion,
				});
			}
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
