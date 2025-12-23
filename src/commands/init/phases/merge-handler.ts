/**
 * File merging and manifest tracking phase
 * Handles file merge, legacy migration, ownership tracking, and manifest writing
 */

import { join } from "node:path";
import { FileMerger } from "@/domains/installation/file-merger.js";
import { LegacyMigration } from "@/domains/migration/legacy-migration.js";
import { ReleaseManifestLoader } from "@/domains/migration/release-manifest.js";
import { FileScanner } from "@/services/file-operations/file-scanner.js";
import {
	buildFileTrackingList,
	trackFilesWithProgress,
} from "@/services/file-operations/manifest/index.js";
import { CommandsPrefix } from "@/services/transformers/commands-prefix.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import { pathExists } from "fs-extra";
import type { InitContext } from "../types.js";

/**
 * Merge files and track ownership
 */
export async function handleMerge(ctx: InitContext): Promise<InitContext> {
	if (
		ctx.cancelled ||
		!ctx.extractDir ||
		!ctx.resolvedDir ||
		!ctx.claudeDir ||
		!ctx.kit ||
		!ctx.release ||
		!ctx.kitType
	) {
		return ctx;
	}

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
				ctx.release.tag_name,
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

	// Build file tracking list and track with progress
	const installedFiles = merger.getAllInstalledFiles();
	const filesToTrack = buildFileTrackingList({
		installedFiles,
		claudeDir: ctx.claudeDir,
		releaseManifest,
		installedVersion: ctx.release.tag_name,
		isGlobal: ctx.options.global,
	});

	await trackFilesWithProgress(filesToTrack, {
		claudeDir: ctx.claudeDir,
		kitName: ctx.kit.name,
		releaseTag: ctx.release.tag_name,
		mode: ctx.options.global ? "global" : "local",
		kitType: ctx.kitType,
	});

	return {
		...ctx,
		customClaudeFiles,
		includePatterns,
	};
}
