/**
 * File merging and manifest tracking phase
 * Handles file merge, legacy migration, ownership tracking, and manifest writing
 */

import { join } from "node:path";
import { handleDeletions } from "@/domains/installation/deletion-handler.js";
import { FileMerger } from "@/domains/installation/file-merger.js";
import { LegacyMigration } from "@/domains/migration/legacy-migration.js";
import { ReleaseManifestLoader } from "@/domains/migration/release-manifest.js";
import { buildConflictSummary, displayConflictSummary } from "@/domains/ui/conflict-summary.js";
import { FileScanner } from "@/services/file-operations/file-scanner.js";
import {
	buildFileTrackingList,
	trackFilesWithProgress,
} from "@/services/file-operations/manifest/index.js";
import { CommandsPrefix } from "@/services/transformers/commands-prefix.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import type { ClaudeKitMetadata } from "@/types";
import { pathExists, readFile } from "fs-extra";
import type { InitContext } from "../types.js";

/**
 * Merge files and track ownership
 */
export async function handleMerge(ctx: InitContext): Promise<InitContext> {
	// Note: ctx.release may be undefined in offline mode (--kit-path, --archive)
	// This is valid - we use "local" as fallback version for tracking
	if (
		ctx.cancelled ||
		!ctx.extractDir ||
		!ctx.resolvedDir ||
		!ctx.claudeDir ||
		!ctx.kit ||
		!ctx.kitType
	) {
		return ctx;
	}

	// Determine version for tracking (fallback to "local" for offline installations)
	const installedVersion = ctx.release?.tag_name ?? "local";

	// Scan for custom .claude files to preserve (skip if --fresh)
	let customClaudeFiles: string[] = [];
	if (!ctx.options.fresh) {
		logger.info("Scanning for custom .claude files...");
		const scanSourceDir = ctx.options.global ? join(ctx.extractDir, ".claude") : ctx.extractDir;
		const scanTargetSubdir = ctx.options.global ? "" : ".claude";
		customClaudeFiles = await FileScanner.findCustomFiles(
			ctx.resolvedDir,
			scanSourceDir,
			scanTargetSubdir,
		);
	} else {
		logger.debug("Skipping custom file scan (fresh installation)");
	}

	// Handle selective update logic
	let includePatterns: string[] = [];

	if (ctx.options.only && ctx.options.only.length > 0) {
		includePatterns = ctx.options.only;
		logger.info(`Including only: ${includePatterns.join(", ")}`);
	} else if (!ctx.isNonInteractive) {
		const updateEverything = await ctx.prompts.promptUpdateMode();

		if (!updateEverything) {
			includePatterns = await ctx.prompts.promptDirectorySelection(ctx.options.global);
			logger.info(`Selected directories: ${includePatterns.join(", ")}`);
		}
	}

	output.section("Installing");
	logger.verbose("Installation target", {
		directory: ctx.resolvedDir,
		mode: ctx.options.global ? "global" : "local",
	});

	// Set up file merger
	const merger = new FileMerger();

	if (includePatterns.length > 0) {
		merger.setIncludePatterns(includePatterns);
	}

	if (customClaudeFiles.length > 0) {
		merger.addIgnorePatterns(customClaudeFiles);
		logger.success(`Protected ${customClaudeFiles.length} custom .claude file(s)`);
	}

	if (ctx.options.exclude && ctx.options.exclude.length > 0) {
		merger.addIgnorePatterns(ctx.options.exclude);
	}

	merger.setGlobalFlag(ctx.options.global);
	merger.setForceOverwriteSettings(ctx.options.forceOverwriteSettings);
	merger.setProjectDir(ctx.resolvedDir);
	merger.setKitName(ctx.kit.name);

	// Set multi-kit context for cross-kit file awareness
	if (ctx.kitType) {
		merger.setMultiKitContext(ctx.claudeDir, ctx.kitType);
	}

	// Load release manifest and handle legacy migration
	const releaseManifest = await ReleaseManifestLoader.load(ctx.extractDir);

	if (releaseManifest) {
		merger.setManifest(releaseManifest);
	}

	// Legacy migration
	if (!ctx.options.fresh && (await pathExists(ctx.claudeDir))) {
		const legacyDetection = await LegacyMigration.detectLegacy(ctx.claudeDir);

		if (legacyDetection.isLegacy && releaseManifest) {
			logger.info("Legacy installation detected - migrating to ownership tracking...");
			await LegacyMigration.migrate(
				ctx.claudeDir,
				releaseManifest,
				ctx.kit.name,
				installedVersion,
				!ctx.isNonInteractive,
			);
			logger.success("Migration complete");
		}
	}

	// Clean up commands directory if using --prefix flag
	if (CommandsPrefix.shouldApplyPrefix(ctx.options)) {
		const cleanupResult = await CommandsPrefix.cleanupCommandsDirectory(
			ctx.resolvedDir,
			ctx.options.global,
			{
				dryRun: ctx.options.dryRun,
				forceOverwrite: ctx.options.forceOverwrite,
				kitType: ctx.kitType,
			},
		);

		if (ctx.options.dryRun) {
			const { OwnershipDisplay } = await import("@/domains/ui/ownership-display.js");
			OwnershipDisplay.displayOperationPreview(cleanupResult.results);
			ctx.prompts.outro("Dry-run complete. No changes were made.");
			return { ...ctx, cancelled: true };
		}
	}

	// Merge files
	const sourceDir = ctx.options.global ? join(ctx.extractDir, ".claude") : ctx.extractDir;
	await merger.merge(sourceDir, ctx.resolvedDir, ctx.isNonInteractive);

	// Display conflict resolution summary if any conflicts occurred
	const fileConflicts = merger.getFileConflicts();
	if (fileConflicts.length > 0 && !ctx.isNonInteractive) {
		const summary = buildConflictSummary(fileConflicts, [], []);
		displayConflictSummary(summary);
	}

	// Handle deletions from source kit metadata (cleanup deprecated files)
	try {
		// Metadata is always at .claude/metadata.json regardless of install mode
		// For global: sourceDir is extractDir/.claude, so we look at sourceDir/metadata.json
		// For local: sourceDir is extractDir, so we look at sourceDir/.claude/metadata.json
		const sourceMetadataPath = ctx.options.global
			? join(sourceDir, "metadata.json")
			: join(sourceDir, ".claude", "metadata.json");
		if (await pathExists(sourceMetadataPath)) {
			const metadataContent = await readFile(sourceMetadataPath, "utf-8");
			const sourceMetadata: ClaudeKitMetadata = JSON.parse(metadataContent);

			if (sourceMetadata.deletions && sourceMetadata.deletions.length > 0) {
				const deletionResult = await handleDeletions(sourceMetadata, ctx.claudeDir);

				if (deletionResult.deletedPaths.length > 0) {
					logger.info(`Removed ${deletionResult.deletedPaths.length} deprecated file(s)`);
					for (const path of deletionResult.deletedPaths) {
						logger.verbose(`  - ${path}`);
					}
				}

				if (deletionResult.preservedPaths.length > 0) {
					logger.verbose(`Preserved ${deletionResult.preservedPaths.length} user-owned file(s)`);
				}
			}
		} else {
			logger.debug(`No source metadata found at ${sourceMetadataPath}, skipping deletions`);
		}
	} catch (error) {
		// Don't fail install on deletion errors - just log and continue
		logger.debug(`Cleanup of deprecated files failed: ${error}`);
	}

	// Build file tracking list and track with progress
	const installedFiles = merger.getAllInstalledFiles();
	const filesToTrack = buildFileTrackingList({
		installedFiles,
		claudeDir: ctx.claudeDir,
		releaseManifest,
		installedVersion,
		isGlobal: ctx.options.global,
	});

	await trackFilesWithProgress(filesToTrack, {
		claudeDir: ctx.claudeDir,
		kitName: ctx.kit.name,
		releaseTag: installedVersion,
		mode: ctx.options.global ? "global" : "local",
		kitType: ctx.kitType,
	});

	return {
		...ctx,
		customClaudeFiles,
		includePatterns,
	};
}
