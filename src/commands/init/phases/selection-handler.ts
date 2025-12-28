/**
 * Kit, directory, and version selection phase
 * Handles interactive and non-interactive selection of kit, target directory, and version
 */

import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { handleFreshInstallation } from "@/domains/installation/fresh-installer.js";
import { readClaudeKitMetadata } from "@/services/file-operations/claudekit-scanner.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { createSpinner } from "@/shared/safe-spinner.js";
import { AVAILABLE_KITS, type KitType } from "@/types";
import { pathExists } from "fs-extra";
import type { InitContext } from "../types.js";
import { isSyncContext } from "../types.js";

/**
 * Select kit, target directory, and version
 */
export async function handleSelection(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled) return ctx;

	// Check if sync mode has already set these values
	if (isSyncContext(ctx) && ctx.kitType && ctx.resolvedDir && ctx.selectedVersion) {
		// Sync mode: values already set, just fetch the kit and release
		const kit = AVAILABLE_KITS[ctx.kitType];
		const github = new GitHubClient();

		logger.info(`Sync mode: using ${kit.name} version ${ctx.selectedVersion}`);

		const release = await github.getReleaseByTag(kit, ctx.selectedVersion);

		return {
			...ctx,
			kit,
			release,
		};
	}

	// Load config for defaults
	const config = await ConfigManager.get();

	// Get kit selection
	let kitType: KitType = (ctx.options.kit || config.defaults?.kit) as KitType;
	if (!kitType) {
		if (ctx.isNonInteractive) {
			kitType = "engineer";
			logger.info("Using default kit: engineer");
		} else {
			kitType = await ctx.prompts.selectKit();
		}
	}

	const kit = AVAILABLE_KITS[kitType];
	logger.info(`Selected kit: ${kit.name}`);

	// Get target directory
	let targetDir: string;

	if (ctx.explicitDir) {
		targetDir = ctx.options.dir;
		logger.info(`Using explicit directory: ${targetDir}`);
	} else if (ctx.options.global) {
		targetDir = PathResolver.getGlobalKitDir();
		logger.info(`Using global kit directory: ${targetDir}`);
	} else {
		targetDir = config.defaults?.dir || ".";
		if (!config.defaults?.dir) {
			if (ctx.isNonInteractive) {
				logger.info("Using current directory as target");
			} else {
				targetDir = await ctx.prompts.getDirectory(targetDir);
			}
		}
	}

	const resolvedDir = resolve(targetDir);
	logger.info(`Target directory: ${resolvedDir}`);

	// Check if directory exists (create if global mode)
	if (!(await pathExists(resolvedDir))) {
		if (ctx.options.global) {
			await mkdir(resolvedDir, { recursive: true });
			logger.info(`Created global directory: ${resolvedDir}`);
		} else {
			logger.error(`Directory does not exist: ${resolvedDir}`);
			logger.info('Use "ck new" to create a new project');
			return { ...ctx, cancelled: true };
		}
	}

	// Handle --fresh flag: completely remove .claude directory
	if (ctx.options.fresh) {
		const prefix = PathResolver.getPathPrefix(ctx.options.global);
		const claudeDir = prefix ? join(resolvedDir, prefix) : resolvedDir;

		const canProceed = await handleFreshInstallation(claudeDir, ctx.prompts);
		if (!canProceed) {
			return { ...ctx, cancelled: true };
		}
	}

	// Check repository access
	const github = new GitHubClient();
	const spinner = createSpinner("Checking repository access...").start();
	logger.verbose("GitHub API check", { repo: kit.repo, owner: kit.owner });

	try {
		await github.checkAccess(kit);
		spinner.succeed("Repository access verified");
	} catch (error: any) {
		spinner.fail("Access denied to repository");
		logger.error(error.message || `Cannot access ${kit.name}`);
		return { ...ctx, cancelled: true };
	}

	// Determine version selection
	let selectedVersion: string | undefined = ctx.options.release;

	// Non-interactive mode without explicit version handling
	if (!selectedVersion && ctx.isNonInteractive && !ctx.options.yes) {
		throw new Error("Non-interactive mode requires either: --release <tag> OR --yes (uses latest)");
	}

	if (!selectedVersion && ctx.options.yes) {
		logger.info("Using latest stable version (--yes flag)");
	}

	// Interactive version selection
	if (!selectedVersion && !ctx.isNonInteractive) {
		logger.info("Fetching available versions...");

		// Get currently installed version
		let currentVersion: string | null = null;
		try {
			const metadataPath = ctx.options.global
				? join(PathResolver.getGlobalKitDir(), "metadata.json")
				: join(resolvedDir, ".claude", "metadata.json");
			const metadata = await readClaudeKitMetadata(metadataPath);
			currentVersion = metadata?.version || null;
			if (currentVersion) {
				logger.debug(`Current installed version: ${currentVersion}`);
			}
		} catch {
			// No existing installation
		}

		try {
			const versionResult = await ctx.prompts.selectVersionEnhanced({
				kit,
				includePrereleases: ctx.options.beta,
				limit: 10,
				allowManualEntry: true,
				forceRefresh: ctx.options.refresh,
				currentVersion,
			});

			if (!versionResult) {
				logger.warning("Version selection cancelled by user");
				return { ...ctx, cancelled: true };
			}

			selectedVersion = versionResult;
			logger.success(`Selected version: ${selectedVersion}`);
		} catch (error: any) {
			logger.error("Failed to fetch versions, using latest release");
			logger.debug(`Version selection error: ${error.message}`);
			selectedVersion = undefined;
		}
	}

	// Get release
	let release;
	if (selectedVersion) {
		release = await github.getReleaseByTag(kit, selectedVersion);
	} else {
		if (ctx.options.beta) {
			logger.info("Fetching latest beta release...");
		} else {
			logger.info("Fetching latest release...");
		}
		release = await github.getLatestRelease(kit, ctx.options.beta);
		if (release.prerelease) {
			logger.success(`Found beta: ${release.tag_name}`);
		} else {
			logger.success(`Found: ${release.tag_name}`);
		}
	}

	return {
		...ctx,
		kit,
		kitType,
		resolvedDir,
		release,
		selectedVersion,
	};
}
