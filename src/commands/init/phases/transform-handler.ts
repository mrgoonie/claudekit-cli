/**
 * Path transformation and folder configuration phase
 * Handles global path transforms, prefix application, and custom folder names
 */

import { join } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { CommandsPrefix } from "@/services/transformers/commands-prefix.js";
import {
	transformFolderPaths,
	validateFolderOptions,
} from "@/services/transformers/folder-path-transformer.js";
import { transformPathsForGlobalInstall } from "@/services/transformers/global-path-transformer.js";
import { logger } from "@/shared/logger.js";
import { DEFAULT_FOLDERS } from "@/types";
import type { InitContext } from "../types.js";

/**
 * Apply path transformations and folder configuration
 */
export async function handleTransforms(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled || !ctx.extractDir || !ctx.resolvedDir) return ctx;

	// Apply /ck: prefix if requested
	if (CommandsPrefix.shouldApplyPrefix(ctx.options)) {
		await CommandsPrefix.applyPrefix(ctx.extractDir);
	}

	// Transform paths for global installation
	if (ctx.options.global) {
		logger.info("Transforming paths for global installation...");
		const transformResult = await transformPathsForGlobalInstall(ctx.extractDir, {
			verbose: logger.isVerbose(),
		});
		logger.success(
			`Transformed ${transformResult.totalChanges} path(s) in ${transformResult.filesTransformed} file(s)`,
		);
	}

	// In global mode, auto-migrate .ck.json from nested location if needed
	if (ctx.options.global) {
		await ConfigManager.migrateNestedConfig(ctx.resolvedDir);
	}

	// Resolve folder configuration
	const foldersConfig = await ConfigManager.resolveFoldersConfig(
		ctx.resolvedDir,
		{
			docsDir: ctx.options.docsDir,
			plansDir: ctx.options.plansDir,
		},
		ctx.options.global,
	);

	// Validate custom folder names
	validateFolderOptions(ctx.options);

	// Transform folder paths if custom names are specified
	const hasCustomFolders =
		foldersConfig.docs !== DEFAULT_FOLDERS.docs || foldersConfig.plans !== DEFAULT_FOLDERS.plans;

	if (hasCustomFolders) {
		logger.info(
			`Using custom folder names: docs=${foldersConfig.docs}, plans=${foldersConfig.plans}`,
		);
		const folderTransformResult = await transformFolderPaths(ctx.extractDir, foldersConfig, {
			verbose: logger.isVerbose(),
		});
		logger.success(
			`Transformed ${folderTransformResult.foldersRenamed} folder(s), ` +
				`${folderTransformResult.totalReferences} reference(s) in ${folderTransformResult.filesTransformed} file(s)`,
		);

		// Save folder config to project for future updates (only if CLI flags provided)
		if (ctx.options.docsDir || ctx.options.plansDir) {
			await ConfigManager.saveProjectConfig(
				ctx.resolvedDir,
				{
					docs: foldersConfig.docs,
					plans: foldersConfig.plans,
				},
				ctx.options.global,
			);
			logger.debug(
				ctx.options.global
					? "Saved folder configuration to ~/.claude/.ck.json"
					: "Saved folder configuration to .claude/.ck.json",
			);
		}
	}

	// Determine claude directory path
	const claudeDir = ctx.options.global ? ctx.resolvedDir : join(ctx.resolvedDir, ".claude");

	return {
		...ctx,
		foldersConfig,
		claudeDir,
	};
}
