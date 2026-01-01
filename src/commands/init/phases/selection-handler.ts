/**
 * Kit, directory, and version selection phase
 * Handles interactive and non-interactive selection of kit, target directory, and version
 */

import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { detectAccessibleKits } from "@/domains/github/kit-access-checker.js";
import { handleFreshInstallation } from "@/domains/installation/fresh-installer.js";
import { readClaudeKitMetadata } from "@/services/file-operations/claudekit-scanner.js";
import { readManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
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

	// Detect accessible kits upfront (skip for --use-git mode which uses git credentials)
	let accessibleKits: KitType[] | undefined;
	if (!ctx.options.useGit) {
		accessibleKits = await detectAccessibleKits();

		if (accessibleKits.length === 0) {
			logger.error("No ClaudeKit access found.");
			logger.info("Purchase at https://claudekit.cc");
			return { ...ctx, cancelled: true };
		}
	}

	// Get kit selection
	let kitType: KitType = (ctx.options.kit || config.defaults?.kit) as KitType;

	// Validate explicit --kit flag has access
	if (kitType && accessibleKits && !accessibleKits.includes(kitType)) {
		logger.error(`No access to ${AVAILABLE_KITS[kitType].name}`);
		logger.info("Purchase at https://claudekit.cc");
		return { ...ctx, cancelled: true };
	}

	if (!kitType) {
		if (ctx.isNonInteractive) {
			// Non-interactive requires accessible kit or error
			if (!accessibleKits || accessibleKits.length === 0) {
				throw new Error(
					"Kit must be specified via --kit flag in non-interactive mode (no accessible kits detected)",
				);
			}
			kitType = accessibleKits[0];
			logger.info(`Auto-selected: ${AVAILABLE_KITS[kitType].name}`);
		} else if (accessibleKits?.length === 1) {
			// Only one kit accessible - skip prompt
			kitType = accessibleKits[0];
			logger.info(`Using ${AVAILABLE_KITS[kitType].name} (only accessible kit)`);
		} else {
			// Multiple kits or --use-git mode - prompt with filtered options
			kitType = await ctx.prompts.selectKit(undefined, accessibleKits);
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

	// Check for existing kits and prompt confirmation for multi-kit installation
	if (!ctx.options.fresh) {
		const prefix = PathResolver.getPathPrefix(ctx.options.global);
		const claudeDir = prefix ? join(resolvedDir, prefix) : resolvedDir;

		try {
			const existingMetadata = await readManifest(claudeDir);
			if (existingMetadata?.kits) {
				const existingKitTypes = Object.keys(existingMetadata.kits) as KitType[];
				const otherKits = existingKitTypes.filter((k) => k !== kitType);

				if (otherKits.length > 0) {
					// Format existing kits for display
					const existingKitsDisplay = otherKits
						.map((k) => `${k}@${existingMetadata.kits?.[k]?.version || "unknown"}`)
						.join(", ");

					// Skip confirmation with --yes flag or non-interactive mode
					if (!ctx.options.yes && !ctx.isNonInteractive) {
						try {
							const confirmAdd = await ctx.prompts.confirm(
								`${existingKitsDisplay} already installed. Add ${kit.name} alongside?`,
							);

							if (!confirmAdd) {
								logger.warning("Multi-kit installation cancelled by user");
								return { ...ctx, cancelled: true };
							}
							logger.info(`Adding ${kit.name} alongside existing kit(s)`);
						} catch {
							logger.warning("Prompt cancelled or interrupted");
							return { ...ctx, cancelled: true };
						}
					} else {
						const reason = ctx.options.yes ? "(--yes flag)" : "(non-interactive mode)";
						logger.info(`Adding ${kit.name} alongside ${existingKitsDisplay} ${reason}`);
					}
				}
			}
		} catch (error) {
			// No existing metadata or read error - proceed with installation
			logger.debug(
				`Metadata read skipped: ${error instanceof Error ? error.message : "unknown error"}`,
			);
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

	// Access already verified during kit selection (or skipped for --use-git mode)
	const github = new GitHubClient();

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

	// Get release (skip API call for git clone mode - just need tag name)
	let release;
	if (ctx.options.useGit && selectedVersion) {
		// For git clone, create minimal release object with just the tag
		release = {
			id: 0,
			tag_name: selectedVersion,
			name: selectedVersion,
			draft: false,
			prerelease: selectedVersion.includes("-"),
			tarball_url: `https://github.com/${kit.owner}/${kit.repo}/archive/refs/tags/${selectedVersion}.tar.gz`,
			zipball_url: `https://github.com/${kit.owner}/${kit.repo}/archive/refs/tags/${selectedVersion}.zip`,
			assets: [],
		};
		logger.verbose("Using git clone mode with tag", { tag: selectedVersion });
	} else if (selectedVersion) {
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
