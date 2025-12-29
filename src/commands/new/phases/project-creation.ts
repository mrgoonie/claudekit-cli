/**
 * Project Creation Phase
 *
 * Handles downloading, extracting and installing kit files.
 */

import { join } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { downloadAndExtract } from "@/domains/installation/download-extractor.js";
import { FileMerger } from "@/domains/installation/file-merger.js";
import { ReleaseManifestLoader } from "@/domains/migration/release-manifest.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";
import {
	buildFileTrackingList,
	trackFilesWithProgress,
} from "@/services/file-operations/manifest/index.js";
import { CommandsPrefix } from "@/services/transformers/commands-prefix.js";
import {
	transformFolderPaths,
	validateFolderOptions,
} from "@/services/transformers/folder-path-transformer.js";
import { logger } from "@/shared/logger.js";
import { output } from "@/shared/output-manager.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { AVAILABLE_KITS, DEFAULT_FOLDERS, type KitType, type NewCommandOptions } from "@/types";
import type { NewContext, ProjectCreationResult } from "../types.js";
import { selectVersion } from "./version-selection.js";

/**
 * Create project by downloading and installing kit files
 */
export async function projectCreation(
	kit: KitType,
	resolvedDir: string,
	validOptions: NewCommandOptions,
	isNonInteractive: boolean,
	prompts: PromptsManager,
): Promise<ProjectCreationResult | null> {
	const kitConfig = AVAILABLE_KITS[kit];

	// Initialize GitHub client
	const github = new GitHubClient();

	// Check repository access (skip for git clone mode - uses git credentials instead)
	if (!validOptions.useGit) {
		const spinner = createSpinner("Checking repository access...").start();
		logger.verbose("GitHub API check", { repo: kitConfig.repo, owner: kitConfig.owner });
		try {
			await github.checkAccess(kitConfig);
			spinner.succeed("Repository access verified");
		} catch (error: any) {
			spinner.fail("Access denied to repository");
			// Display detailed error message (includes PAT troubleshooting)
			logger.error(error.message || `Cannot access ${kitConfig.name}`);
			return null;
		}
	} else {
		logger.verbose("Skipping API access check (--use-git mode)");
	}

	// Select version (interactive or explicit)
	const versionResult = await selectVersion(
		kitConfig,
		validOptions,
		isNonInteractive,
		prompts,
		github,
	);
	if (!versionResult) {
		return null;
	}
	const { release } = versionResult;

	// Download and extract release
	const { extractDir } = await downloadAndExtract({
		release,
		kit: kitConfig,
		exclude: validOptions.exclude,
		useGit: validOptions.useGit,
		isNonInteractive,
	});

	// Apply /ck: prefix if requested
	if (CommandsPrefix.shouldApplyPrefix(validOptions)) {
		await CommandsPrefix.applyPrefix(extractDir);
	}

	// Resolve folder configuration
	const foldersConfig = await ConfigManager.resolveFoldersConfig(resolvedDir, {
		docsDir: validOptions.docsDir,
		plansDir: validOptions.plansDir,
	});

	// Validate custom folder names
	validateFolderOptions(validOptions);

	// Transform folder paths if custom names are specified
	const hasCustomFolders =
		foldersConfig.docs !== DEFAULT_FOLDERS.docs || foldersConfig.plans !== DEFAULT_FOLDERS.plans;

	if (hasCustomFolders) {
		const transformResult = await transformFolderPaths(extractDir, foldersConfig, {
			verbose: logger.isVerbose(),
		});
		logger.success(
			`Transformed ${transformResult.foldersRenamed} folder(s), ` +
				`${transformResult.totalReferences} reference(s) in ${transformResult.filesTransformed} file(s)`,
		);

		// Save folder config to project for future updates
		await ConfigManager.saveProjectConfig(resolvedDir, {
			docs: foldersConfig.docs,
			plans: foldersConfig.plans,
		});
		logger.debug("Saved folder configuration to .claude/.ck.json");
	}

	output.section("Installing");
	logger.verbose("Installation target", { directory: resolvedDir });

	// Copy files to target directory
	const merger = new FileMerger();

	// Apply user exclude patterns if provided
	if (validOptions.exclude && validOptions.exclude.length > 0) {
		merger.addIgnorePatterns(validOptions.exclude);
	}

	// Clean up existing commands directory if using --prefix flag
	// This handles cases where --force is used to overwrite an existing project
	if (CommandsPrefix.shouldApplyPrefix(validOptions)) {
		await CommandsPrefix.cleanupCommandsDirectory(resolvedDir, false); // new command is never global
	}

	await merger.merge(extractDir, resolvedDir, true); // Skip confirmation for new projects

	// Build file tracking list and track with progress
	const claudeDir = join(resolvedDir, ".claude");
	const releaseManifest = await ReleaseManifestLoader.load(extractDir);
	const installedFiles = merger.getAllInstalledFiles();

	const filesToTrack = buildFileTrackingList({
		installedFiles,
		claudeDir,
		releaseManifest,
		installedVersion: release.tag_name,
		isGlobal: false, // new command is always local
	});

	await trackFilesWithProgress(filesToTrack, {
		claudeDir,
		kitName: kitConfig.name,
		releaseTag: release.tag_name,
		mode: "local", // new command is always local
	});

	return {
		releaseTag: release.tag_name,
		installedFiles,
		claudeDir,
	};
}

/**
 * Context handler for project creation phase
 */
export async function handleProjectCreation(ctx: NewContext): Promise<NewContext> {
	if (!ctx.kit || !ctx.resolvedDir) {
		return { ...ctx, cancelled: true };
	}

	const result = await projectCreation(
		ctx.kit,
		ctx.resolvedDir,
		ctx.options,
		ctx.isNonInteractive,
		ctx.prompts,
	);

	if (!result) {
		return { ...ctx, cancelled: true };
	}

	return {
		...ctx,
		releaseTag: result.releaseTag,
		installedFiles: result.installedFiles,
		claudeDir: result.claudeDir,
	};
}
