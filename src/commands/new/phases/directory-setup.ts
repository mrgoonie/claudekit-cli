/**
 * Directory Setup Phase
 *
 * Handles directory creation and validation for new projects.
 */

import { resolve } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { detectAccessibleKits } from "@/domains/github/kit-access-checker.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";
import { logger } from "@/shared/logger.js";
import { AVAILABLE_KITS, type KitType, type NewCommandOptions } from "@/types";
import { pathExists, readdir } from "fs-extra";
import type { DirectorySetupResult, NewContext } from "../types.js";

/**
 * Setup directory and kit selection for new project
 */
export async function directorySetup(
	validOptions: NewCommandOptions,
	prompts: PromptsManager,
): Promise<DirectorySetupResult | null> {
	// Detect non-interactive mode
	const isNonInteractive =
		!process.stdin.isTTY || process.env.CI === "true" || process.env.NON_INTERACTIVE === "true";

	// Load config for defaults
	const config = await ConfigManager.get();

	// Detect accessible kits upfront (skip for --use-git mode which uses git credentials)
	let accessibleKits: KitType[] | undefined;
	if (!validOptions.useGit) {
		accessibleKits = await detectAccessibleKits();

		if (accessibleKits.length === 0) {
			logger.error("No ClaudeKit access found.");
			logger.info("Purchase at https://claudekit.cc");
			return null;
		}
	}

	// Get kit selection - parse "all", comma-separated, or single kit
	const allKitTypes: KitType[] = Object.keys(AVAILABLE_KITS) as KitType[];
	let kit: KitType | undefined;
	const kitOption = validOptions.kit || config.defaults?.kit;

	if (kitOption) {
		if (kitOption === "all") {
			// --kit all: use first accessible kit (new command creates single project)
			const kitsToUse = accessibleKits ?? allKitTypes;
			if (kitsToUse.length === 0) {
				logger.error("No kits accessible for installation");
				return null;
			}
			kit = kitsToUse[0];
			logger.info(`Using ${AVAILABLE_KITS[kit].name} for new project`);
		} else if (kitOption.includes(",")) {
			// Comma-separated: use first valid kit (new command creates single project)
			const requestedKits = kitOption.split(",").map((k) => k.trim()) as KitType[];
			const validKits = requestedKits.filter((k) => allKitTypes.includes(k));
			if (validKits.length === 0) {
				logger.error(`Invalid kit(s): ${requestedKits.join(", ")}`);
				logger.info(`Valid kits: ${allKitTypes.join(", ")}`);
				return null;
			}
			kit = validKits[0];
			if (accessibleKits && !accessibleKits.includes(kit)) {
				logger.error(`No access to ${AVAILABLE_KITS[kit].name}`);
				logger.info("Purchase at https://claudekit.cc");
				return null;
			}
		} else {
			// Single kit
			if (!allKitTypes.includes(kitOption as KitType)) {
				logger.error(`Invalid kit: ${kitOption}`);
				logger.info(`Valid kits: ${allKitTypes.join(", ")}`);
				return null;
			}
			kit = kitOption as KitType;
			if (accessibleKits && !accessibleKits.includes(kit)) {
				logger.error(`No access to ${AVAILABLE_KITS[kit].name}`);
				logger.info("Purchase at https://claudekit.cc");
				return null;
			}
		}
	}

	if (!kit) {
		if (isNonInteractive) {
			// Pick first accessible (or error if none)
			kit = accessibleKits?.[0];
			if (!kit) {
				throw new Error("Kit must be specified via --kit flag in non-interactive mode");
			}
			logger.info(`Auto-selected: ${AVAILABLE_KITS[kit].name}`);
		} else if (accessibleKits?.length === 1) {
			// Only one kit accessible - skip prompt
			kit = accessibleKits[0];
			logger.info(`Using ${AVAILABLE_KITS[kit].name} (only accessible kit)`);
		} else {
			// Multiple kits or --use-git mode - prompt with filtered options
			kit = await prompts.selectKit(undefined, accessibleKits);
		}
	}

	const kitConfig = AVAILABLE_KITS[kit];
	logger.info(`Selected kit: ${kitConfig.name}`);

	// Get target directory
	let targetDir = validOptions.dir || config.defaults?.dir || ".";
	if (!validOptions.dir && !config.defaults?.dir) {
		if (isNonInteractive) {
			targetDir = ".";
		} else {
			targetDir = await prompts.getDirectory(targetDir);
		}
	}

	const resolvedDir = resolve(targetDir);
	logger.info(`Target directory: ${resolvedDir}`);

	// Check if directory exists and is not empty
	if (await pathExists(resolvedDir)) {
		const files = await readdir(resolvedDir);
		const isEmpty = files.length === 0;
		if (!isEmpty) {
			if (isNonInteractive) {
				if (!validOptions.force) {
					throw new Error(
						"Directory is not empty. Use --force flag to overwrite in non-interactive mode",
					);
				}
				logger.info("Directory is not empty. Proceeding with --force flag");
			} else {
				const continueAnyway = await prompts.confirm(
					"Directory is not empty. Files may be overwritten. Continue?",
				);
				if (!continueAnyway) {
					logger.warning("Operation cancelled");
					return null;
				}
			}
		}
	}

	return {
		kit,
		resolvedDir,
		isNonInteractive,
	};
}

/**
 * Context handler for directory setup phase
 */
export async function handleDirectorySetup(ctx: NewContext): Promise<NewContext> {
	const result = await directorySetup(ctx.options, ctx.prompts);

	if (!result) {
		return { ...ctx, cancelled: true };
	}

	return {
		...ctx,
		kit: result.kit,
		resolvedDir: result.resolvedDir,
		isNonInteractive: result.isNonInteractive,
	};
}
