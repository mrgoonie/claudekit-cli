/**
 * Kit, directory, and version selection phase
 * Handles interactive and non-interactive selection of kit, target directory, and version
 */

import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ConfigManager } from "@/domains/config/config-manager.js";
import { GitHubClient } from "@/domains/github/github-client.js";
import { detectAccessibleKits } from "@/domains/github/kit-access-checker.js";
import { runPreflightChecks } from "@/domains/github/preflight-checker.js";
import { handleFreshInstallation } from "@/domains/installation/fresh-installer.js";
import { readClaudeKitMetadata } from "@/services/file-operations/claudekit-scanner.js";
import { readManifest } from "@/services/file-operations/manifest/manifest-reader.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { AVAILABLE_KITS, type KitType, isValidKitType } from "@/types";
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

	// Validate mutually exclusive download methods (explicit without type assertion)
	const downloadMethods: string[] = [];
	if (ctx.options.useGit) downloadMethods.push("--use-git");
	if (ctx.options.archive) downloadMethods.push("--archive");
	if (ctx.options.kitPath) downloadMethods.push("--kit-path");

	if (downloadMethods.length > 1) {
		logger.error(`Mutually exclusive download methods: ${downloadMethods.join(", ")}`);
		logger.info("Use only one of: --use-git, --archive, or --kit-path");
		return { ...ctx, cancelled: true };
	}

	// Load config for defaults
	const config = await ConfigManager.get();

	// Detect accessible kits upfront (skip for offline modes that bypass GitHub API)
	let accessibleKits: KitType[] | undefined;
	if (!ctx.options.useGit && !ctx.options.kitPath && !ctx.options.archive) {
		// Run pre-flight checks first to validate gh CLI before attempting kit access detection
		const preflight = await runPreflightChecks();

		if (!preflight.success) {
			// Output error messages with appropriate log levels
			for (const line of preflight.errorLines) {
				if (line.startsWith("✗")) {
					logger.error(line);
				} else {
					logger.info(line);
				}
			}
			logger.info("");
			logger.info("Full diagnostics: ck doctor");
			return { ...ctx, cancelled: true };
		}

		// Pre-flight passed, now check kit access
		accessibleKits = await detectAccessibleKits();

		if (accessibleKits.length === 0) {
			// Pre-flight passed but no access = real access issue (not a gh CLI problem)
			logger.error("No ClaudeKit repository access found.");
			logger.info("Check email for GitHub invitation, or purchase at https://claudekit.cc");
			logger.info("");
			logger.info("Full diagnostics: ck doctor");
			return { ...ctx, cancelled: true };
		}
	}

	// Get kit selection
	let kitType: KitType | undefined;
	let pendingKits: KitType[] | undefined;

	// Parse --kit option: supports "all", "engineer,marketing", or single kit
	const kitOption = ctx.options.kit || config.defaults?.kit;
	if (kitOption) {
		const allKitTypes: KitType[] = Object.keys(AVAILABLE_KITS) as KitType[];

		if (kitOption === "all") {
			// --kit all: install all accessible kits
			const kitsToInstall = accessibleKits ?? allKitTypes;
			if (kitsToInstall.length === 0) {
				logger.error("No kits accessible for installation");
				return { ...ctx, cancelled: true };
			}
			kitType = kitsToInstall[0];
			if (kitsToInstall.length > 1) {
				pendingKits = kitsToInstall.slice(1);
			}
			logger.info(
				`Installing all accessible kits: ${kitsToInstall.map((k) => AVAILABLE_KITS[k].name).join(", ")}`,
			);
		} else if (kitOption.includes(",")) {
			// Comma-separated: --kit engineer,marketing
			const rawKits = kitOption.split(",").map((k) => k.trim());
			// Deduplicate and validate each kit
			const seen = new Set<string>();
			const requestedKits: KitType[] = [];
			const invalidKits: string[] = [];
			for (const kit of rawKits) {
				if (seen.has(kit)) continue; // Skip duplicates
				seen.add(kit);
				if (isValidKitType(kit)) {
					requestedKits.push(kit);
				} else {
					invalidKits.push(kit);
				}
			}
			if (invalidKits.length > 0) {
				logger.error(`Invalid kit(s): ${invalidKits.join(", ")}`);
				logger.info(`Valid kits: ${allKitTypes.join(", ")}`);
				return { ...ctx, cancelled: true };
			}
			if (requestedKits.length === 0) {
				logger.error("No valid kits specified");
				return { ...ctx, cancelled: true };
			}
			// Validate access for all requested kits
			if (accessibleKits) {
				const noAccessKits = requestedKits.filter((k) => !accessibleKits.includes(k));
				if (noAccessKits.length > 0) {
					logger.error(
						`No access to: ${noAccessKits.map((k) => AVAILABLE_KITS[k].name).join(", ")}`,
					);
					logger.info("Purchase at https://claudekit.cc");
					return { ...ctx, cancelled: true };
				}
			}
			kitType = requestedKits[0];
			if (requestedKits.length > 1) {
				pendingKits = requestedKits.slice(1);
			}
			logger.info(
				`Installing kits: ${requestedKits.map((k) => AVAILABLE_KITS[k].name).join(", ")}`,
			);
		} else {
			// Single kit - validate before cast
			if (!isValidKitType(kitOption)) {
				logger.error(`Invalid kit: ${kitOption}`);
				logger.info(`Valid kits: ${allKitTypes.join(", ")}`);
				return { ...ctx, cancelled: true };
			}
			kitType = kitOption;
			// Validate explicit --kit flag has access
			if (accessibleKits && !accessibleKits.includes(kitType)) {
				logger.error(`No access to ${AVAILABLE_KITS[kitType].name}`);
				logger.info("Purchase at https://claudekit.cc");
				return { ...ctx, cancelled: true };
			}
		}
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
		} else if (accessibleKits && accessibleKits.length > 1) {
			// Multiple kits accessible (>1 = at least 2, matching MIN_KITS_FOR_MULTISELECT)
			// Use multi-select prompt
			const selectedKits = await ctx.prompts.selectKits(accessibleKits);
			// Defensive check: selectKits uses required:true which prevents empty selection,
			// but we validate here as well for robustness
			if (selectedKits.length === 0) {
				throw new Error("At least one kit must be selected");
			}
			// First kit is the primary, rest are pending
			kitType = selectedKits[0];
			if (selectedKits.length > 1) {
				pendingKits = selectedKits.slice(1);
				logger.success(
					`Selected ${selectedKits.length} kits: ${selectedKits.map((k) => AVAILABLE_KITS[k].name).join(", ")}`,
				);
			}
		} else {
			// --use-git mode - single select from all kits
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

	// HOME directory detection: warn if installing to HOME without --global flag
	// Installing to HOME's .claude/ is effectively a global installation
	if (!ctx.options.global && PathResolver.isLocalSameAsGlobal(resolvedDir)) {
		logger.warning("You're at HOME directory. Installing here modifies your GLOBAL ClaudeKit.");

		if (!ctx.isNonInteractive) {
			// Interactive mode: offer choices
			const choice = await ctx.prompts.selectScope();
			if (choice === "cancel") {
				return { ...ctx, cancelled: true };
			}
			if (choice === "global") {
				// User confirmed global installation - continue with same resolved directory
				logger.info("Proceeding with global installation");
			}
			// "different" choice would require re-prompting for directory, but for simplicity
			// we just cancel and ask them to run from a different directory
			if (choice === "different") {
				logger.info("Please run 'ck init' from a project directory instead.");
				return { ...ctx, cancelled: true };
			}
		} else {
			// Non-interactive: fail with clear message
			logger.error("Cannot use local installation at HOME directory.");
			logger.info("Use -g/--global flag or run from a project directory.");
			return { ...ctx, cancelled: true };
		}
	}

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

	// Determine if we're using an offline installation method (skip GitHub API entirely)
	const isOfflineMode = !!(ctx.options.kitPath || ctx.options.archive);

	// Access already verified during kit selection (or skipped for offline modes)
	const github = isOfflineMode ? null : new GitHubClient();

	// Determine version selection
	let selectedVersion: string | undefined = ctx.options.release;

	// Non-interactive mode without explicit version handling
	// Note: --kit-path and --archive don't require --release (version comes from local files)
	if (!selectedVersion && ctx.isNonInteractive && !ctx.options.yes && !isOfflineMode) {
		throw new Error("Non-interactive mode requires either: --release <tag> OR --yes (uses latest)");
	}

	if (!selectedVersion && ctx.options.yes && !isOfflineMode) {
		logger.info("Using latest stable version (--yes flag)");
	}

	// Interactive version selection (skip for offline modes)
	if (!selectedVersion && !ctx.isNonInteractive && !isOfflineMode) {
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

	// Get release (skip API call for offline modes and git clone mode)
	let release;
	if (isOfflineMode) {
		// Offline modes (--kit-path, --archive) don't need release info
		// download-handler.ts will use local files directly
		release = undefined;
		logger.verbose("Offline mode - skipping release fetch", {
			kitPath: ctx.options.kitPath,
			archive: ctx.options.archive,
		});
	} else if (ctx.options.useGit && selectedVersion) {
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
	} else if (selectedVersion && github) {
		release = await github.getReleaseByTag(kit, selectedVersion);
	} else if (github) {
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
		pendingKits,
		accessibleKits,
	};
}
