/**
 * Analysis Handler
 *
 * Analyzes installations for uninstall (ownership-aware).
 */

import { readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAllTrackedFiles } from "@/domains/migration/metadata-migration.js";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { logger } from "@/shared/logger.js";
import { log } from "@/shared/safe-prompts.js";
import type { KitType } from "@/types";
import { pathExists } from "fs-extra";
import pc from "picocolors";
import type { Installation } from "./installation-detector.js";

/**
 * Result of analyzing what would be removed
 */
export interface UninstallAnalysis {
	toDelete: { path: string; reason: string }[];
	toPreserve: { path: string; reason: string }[];
	retainedManifestPaths: string[];
	protectedTrackedPaths: string[];
}

/**
 * Classification result for a file based on ownership
 */
interface FileClassification {
	action: "delete" | "preserve";
	reason: string;
}

function normalizeTrackedPath(relativePath: string): string {
	return relativePath.replace(/\\/g, "/");
}

/**
 * Classify a file for deletion or preservation based on ownership status.
 * Centralizes the ownership-based decision logic for consistent behavior.
 */
function classifyFileByOwnership(
	ownership: "ck" | "ck-modified" | "user",
	forceOverwrite: boolean,
	deleteReason: string,
): FileClassification {
	if (ownership === "ck") {
		return { action: "delete", reason: deleteReason };
	}
	if (ownership === "ck-modified") {
		if (forceOverwrite) {
			return { action: "delete", reason: "force overwrite" };
		}
		return { action: "preserve", reason: "modified by user" };
	}
	// ownership === "user"
	return { action: "preserve", reason: "user-created" };
}

/**
 * Remove empty parent directories up to the installation root
 */
export async function cleanupEmptyDirectories(
	filePath: string,
	installationRoot: string,
): Promise<number> {
	let cleaned = 0;
	let currentDir = dirname(filePath);

	while (currentDir !== installationRoot && currentDir.startsWith(installationRoot)) {
		try {
			const entries = readdirSync(currentDir);
			if (entries.length === 0) {
				rmSync(currentDir, { recursive: true });
				cleaned++;
				logger.debug(`Removed empty directory: ${currentDir}`);
				currentDir = dirname(currentDir);
			} else {
				break; // Directory not empty, stop
			}
		} catch {
			break; // Can't read directory, stop
		}
	}

	return cleaned;
}

/**
 * Analyze installation for uninstall (used by both dry-run and actual removal)
 * Supports kit-scoped analysis for multi-kit installations
 */
export async function analyzeInstallation(
	installation: Installation,
	forceOverwrite: boolean,
	kit?: KitType,
): Promise<UninstallAnalysis & { remainingKits: KitType[] }> {
	const result: UninstallAnalysis & { remainingKits: KitType[] } = {
		toDelete: [],
		toPreserve: [],
		retainedManifestPaths: [],
		protectedTrackedPaths: [],
		remainingKits: [],
	};
	const metadata = await ManifestWriter.readManifest(installation.path);

	// Get uninstall manifest (kit-scoped if specified)
	const uninstallManifest = await ManifestWriter.getUninstallManifest(installation.path, kit);
	result.remainingKits = uninstallManifest.remainingKits;

	// Multi-kit format with kit-scoped uninstall
	if (uninstallManifest.isMultiKit && kit && metadata?.kits?.[kit]) {
		const preservedPaths = new Set(
			uninstallManifest.filesToPreserve.map((filePath) => normalizeTrackedPath(filePath)),
		);

		for (const remainingKit of result.remainingKits) {
			const remainingFiles = metadata.kits?.[remainingKit]?.files || [];
			for (const file of remainingFiles) {
				const relativePath = normalizeTrackedPath(file.path);
				if (await pathExists(join(installation.path, relativePath))) {
					result.retainedManifestPaths.push(relativePath);
				}
			}
		}

		const kitFiles = metadata.kits[kit].files || [];

		for (const trackedFile of kitFiles) {
			const relativePath = normalizeTrackedPath(trackedFile.path);
			const filePath = join(installation.path, relativePath);

			// Check if file is shared with other kits
			if (preservedPaths.has(relativePath)) {
				result.toPreserve.push({ path: relativePath, reason: "shared with other kit" });
				continue;
			}

			const ownershipResult = await OwnershipChecker.checkOwnership(
				filePath,
				metadata,
				installation.path,
			);

			if (!ownershipResult.exists) continue;

			const classification = classifyFileByOwnership(
				ownershipResult.ownership,
				forceOverwrite,
				`${kit} kit (pristine)`,
			);
			if (classification.action === "delete") {
				result.toDelete.push({ path: relativePath, reason: classification.reason });
			} else {
				result.toPreserve.push({ path: relativePath, reason: classification.reason });
				result.protectedTrackedPaths.push(relativePath);
				result.retainedManifestPaths.push(relativePath);
			}
		}

		if (result.retainedManifestPaths.length === 0) {
			result.toDelete.push({ path: "metadata.json", reason: "metadata file" });
		}

		return result;
	}

	// Get all tracked files (handles both multi-kit and legacy format)
	const allTrackedFiles = metadata ? getAllTrackedFiles(metadata) : [];

	// Legacy or full uninstall
	if (!metadata || allTrackedFiles.length === 0) {
		// Legacy mode - just mark directories for deletion
		for (const item of uninstallManifest.filesToRemove) {
			if (!uninstallManifest.filesToPreserve.includes(item)) {
				result.toDelete.push({ path: item, reason: "legacy installation" });
			}
		}
		return result;
	}

	// Ownership-aware analysis for all files
	for (const trackedFile of allTrackedFiles) {
		const relativePath = normalizeTrackedPath(trackedFile.path);
		const filePath = join(installation.path, relativePath);
		const ownershipResult = await OwnershipChecker.checkOwnership(
			filePath,
			metadata,
			installation.path,
		);

		if (!ownershipResult.exists) continue;

		const classification = classifyFileByOwnership(
			ownershipResult.ownership,
			forceOverwrite,
			"CK-owned (pristine)",
		);
		if (classification.action === "delete") {
			result.toDelete.push({ path: relativePath, reason: classification.reason });
		} else {
			result.toPreserve.push({ path: relativePath, reason: classification.reason });
			result.protectedTrackedPaths.push(relativePath);
			result.retainedManifestPaths.push(relativePath);
		}
	}

	if (result.retainedManifestPaths.length === 0) {
		result.toDelete.push({ path: "metadata.json", reason: "metadata file" });
	}

	return result;
}

/**
 * Display dry-run preview
 */
export function displayDryRunPreview(analysis: UninstallAnalysis, installationType: string): void {
	console.log("");
	log.info(pc.bold(`DRY RUN - Preview for ${installationType} installation:`));
	console.log("");

	if (analysis.toDelete.length > 0) {
		console.log(pc.red(pc.bold(`Files to DELETE (${analysis.toDelete.length}):`)));
		const showDelete = analysis.toDelete.slice(0, 10);
		for (const item of showDelete) {
			console.log(`  ${pc.red("✖")} ${item.path}`);
		}
		if (analysis.toDelete.length > 10) {
			console.log(pc.gray(`  ... and ${analysis.toDelete.length - 10} more`));
		}
		console.log("");
	}

	if (analysis.toPreserve.length > 0) {
		console.log(pc.green(pc.bold(`Files to PRESERVE (${analysis.toPreserve.length}):`)));
		const showPreserve = analysis.toPreserve.slice(0, 10);
		for (const item of showPreserve) {
			console.log(`  ${pc.green("✓")} ${item.path} ${pc.gray(`(${item.reason})`)}`);
		}
		if (analysis.toPreserve.length > 10) {
			console.log(pc.gray(`  ... and ${analysis.toPreserve.length - 10} more`));
		}
		console.log("");
	}
}
