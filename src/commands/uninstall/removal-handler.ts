/**
 * Removal Handler
 *
 * Handles the actual removal of ClaudeKit installations.
 * Supports both tracked (metadata.json) and legacy (no metadata) installs.
 */

import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { logger } from "@/shared/logger.js";
import { log } from "@/shared/safe-prompts.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import type { KitType } from "@/types";
import { pathExists, remove } from "fs-extra";
import {
	analyzeInstallation,
	cleanupEmptyDirectories,
	displayDryRunPreview,
} from "./analysis-handler.js";
import type { Installation } from "./installation-detector.js";

/**
 * Check if a path is a directory
 */
function isDirectory(filePath: string): boolean {
	try {
		return statSync(filePath).isDirectory();
	} catch {
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
): Promise<void> {
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
				if (await pathExists(filePath)) {
					// For legacy installs, items may be directories - remove recursively
					if (isDirectory(filePath)) {
						await remove(filePath);
						removedCount++;
						logger.debug(`Removed directory: ${item.path}`);
					} else {
						await remove(filePath);
						removedCount++;
						logger.debug(`Removed: ${item.path}`);

						// Clean up empty parent directories (only for files)
						cleanedDirs += await cleanupEmptyDirectories(filePath, installation.path);
					}
				}
			}

			// Update metadata.json to remove kit (for kit-scoped uninstall)
			if (options.kit && analysis.remainingKits.length > 0) {
				await ManifestWriter.removeKitFromManifest(installation.path, options.kit);
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
		} catch (error) {
			spinner.fail(`Failed to remove ${installation.type} installation`);
			throw new Error(
				`Failed to remove files from ${installation.path}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
