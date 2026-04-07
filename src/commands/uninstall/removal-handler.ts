/**
 * Removal Handler
 *
 * Handles the actual removal of ClaudeKit installations.
 * Supports both tracked (metadata.json) and legacy (no metadata) installs.
 */

import { readdirSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { logger } from "@/shared/logger.js";
import { log } from "@/shared/safe-prompts.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { KitType } from "@/types";
import { lstat, pathExists, realpath, remove } from "fs-extra";
import {
	analyzeInstallation,
	cleanupEmptyDirectories,
	displayDryRunPreview,
} from "./analysis-handler.js";
import type { Installation } from "./installation-detector.js";

export interface UninstallExecutionSummary {
	path: string;
	preservedCustomizations: number;
	protectedTrackedPaths: string[];
}

/**
 * Check if a path is a directory (async, handles errors gracefully)
 */
async function isDirectory(filePath: string): Promise<boolean> {
	try {
		const stats = await lstat(filePath);
		return stats.isDirectory();
	} catch {
		logger.debug(`Failed to check if path is directory: ${filePath}`);
		return false;
	}
}

/**
 * Validate that a path is safe to remove (within base directory, not a symlink escape)
 * Prevents symlink attacks that could delete files outside the installation directory
 */
async function isPathSafeToRemove(filePath: string, baseDir: string): Promise<boolean> {
	try {
		const resolvedPath = resolve(filePath);
		const resolvedBase = resolve(baseDir);

		// Check if path is within base directory
		if (!resolvedPath.startsWith(resolvedBase + sep) && resolvedPath !== resolvedBase) {
			logger.debug(`Path outside installation directory: ${filePath}`);
			return false;
		}

		// Check for symlink escape: if it's a symlink, verify the target is also within base
		const stats = await lstat(filePath);
		if (stats.isSymbolicLink()) {
			const realPath = await realpath(filePath);
			const resolvedReal = resolve(realPath);
			if (!resolvedReal.startsWith(resolvedBase + sep) && resolvedReal !== resolvedBase) {
				logger.debug(`Symlink points outside installation directory: ${filePath} -> ${realPath}`);
				return false;
			}
		}

		return true;
	} catch {
		logger.debug(`Failed to validate path safety: ${filePath}`);
		return false;
	}
}

/**
 * Remove installations with ownership-aware file handling
 * Supports both tracked (metadata.json) and legacy (no metadata) installs
 */
export async function removeInstallations(
	installations: Installation[],
	options: { dryRun: boolean; forceOverwrite: boolean; kit?: KitType },
): Promise<UninstallExecutionSummary[]> {
	const summaries: UninstallExecutionSummary[] = [];

	for (const installation of installations) {
		// Analyze what would be removed
		const analysis = await analyzeInstallation(installation, options.forceOverwrite, options.kit);

		// Dry-run mode: just show preview
		if (options.dryRun) {
			const label = options.kit ? `${installation.type} (${options.kit} kit)` : installation.type;
			const legacyLabel = !installation.hasMetadata ? " [legacy]" : "";
			displayDryRunPreview(analysis, `${label}${legacyLabel}`);
			if (analysis.remainingKits.length > 0) {
				log.info(`Remaining kits after uninstall: ${analysis.remainingKits.join(", ")}`);
			}
			if (!installation.hasMetadata) {
				log.warn("Legacy installation - directories will be removed recursively");
			}
			continue;
		}

		const kitLabel = options.kit ? ` ${options.kit} kit` : "";
		const legacyLabel = !installation.hasMetadata ? " (legacy)" : "";
		const spinner = createSpinner(
			`Removing ${installation.type}${kitLabel}${legacyLabel} ClaudeKit files...`,
		).start();

		try {
			let removedCount = 0;
			let cleanedDirs = 0;

			// Remove files/directories
			for (const item of analysis.toDelete) {
				const filePath = join(installation.path, item.path);
				if (!(await pathExists(filePath))) continue;

				// Security: validate path is safe to remove (symlink protection)
				if (!(await isPathSafeToRemove(filePath, installation.path))) {
					logger.debug(`Skipping unsafe path: ${item.path}`);
					continue;
				}

				// Remove file or directory
				const isDir = await isDirectory(filePath);
				await remove(filePath);
				removedCount++;
				logger.debug(`Removed ${isDir ? "directory" : "file"}: ${item.path}`);

				// Clean up empty parent directories (only for files, not directories)
				if (!isDir) {
					cleanedDirs += await cleanupEmptyDirectories(filePath, installation.path);
				}
			}

			if (analysis.retainedManifestPaths.length > 0) {
				const retained = await ManifestWriter.retainTrackedFilesInManifest(installation.path, [
					...new Set(analysis.retainedManifestPaths),
				]);
				if (!retained) {
					throw new Error("Failed to update metadata.json after partial uninstall");
				}
			}

			// Check if installation directory is now empty, remove it
			try {
				const remaining = readdirSync(installation.path);
				if (remaining.length === 0) {
					rmSync(installation.path, { recursive: true });
					logger.debug(`Removed empty installation directory: ${installation.path}`);
				}
			} catch {
				// Directory might not exist, ignore
			}

			const kitsInfo =
				analysis.remainingKits.length > 0
					? `, ${analysis.remainingKits.join(", ")} kit(s) preserved`
					: "";
			spinner.succeed(
				`Removed ${removedCount} files${cleanedDirs > 0 ? `, cleaned ${cleanedDirs} empty directories` : ""}, preserved ${analysis.toPreserve.length} customizations${kitsInfo}`,
			);

			if (analysis.toPreserve.length > 0) {
				log.info("Preserved customizations:");
				analysis.toPreserve.slice(0, 5).forEach((f) => log.message(`  - ${f.path} (${f.reason})`));
				if (analysis.toPreserve.length > 5) {
					log.message(`  ... and ${analysis.toPreserve.length - 5} more`);
				}
			}

			if (analysis.protectedTrackedPaths.length > 0) {
				log.warn(
					"Protected ClaudeKit files were preserved. Metadata was retained so this installation does not fall back to legacy detection.",
				);
				log.info("Use --force-overwrite to remove those files on the next uninstall run.");
			}

			summaries.push({
				path: installation.path,
				preservedCustomizations: analysis.toPreserve.length,
				protectedTrackedPaths: [...analysis.protectedTrackedPaths],
			});
		} catch (error) {
			spinner.fail(`Failed to remove ${installation.type} installation`);
			throw new Error(
				`Failed to remove files from ${installation.path}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	return summaries;
}
