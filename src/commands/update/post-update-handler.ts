/**
 * Post-Update Handler
 * Steps 2 and 3 of the update pipeline:
 *   Step 2 — promptKitUpdate: auto-init kit content after CLI update
 *   Step 3 — promptMigrateUpdate: auto-migrate installed providers
 */

import { exec, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { builtinModules } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { CkConfigManager } from "@/domains/config/ck-config-manager.js";
import {
	countMissingHookFileReferences,
	repairLegacyHookPrompts,
	repairMissingHookFileReferences,
} from "@/domains/health-checks/checkers/hook-health-checker.js";
import { getInstalledKits } from "@/domains/migration/metadata-migration.js";
import { versionsMatch } from "@/domains/versioning/checking/version-utils.js";
import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { logger } from "@/shared/logger.js";
import { confirm, isCancel, log, spinner } from "@/shared/safe-prompts.js";
import { AVAILABLE_KITS, type KitType, type Metadata, MetadataSchema } from "@/types";
import type { MigrateScopeConfig } from "@/types/ck-config.js";
import { pathExists, readFile } from "fs-extra";
import type {
	ExecAsyncFn,
	KitSelectionParams,
	KitSelectionResult,
	PromptKitUpdateCancelFn,
	PromptKitUpdateConfigLoader,
	PromptKitUpdateConfirmFn,
	PromptKitUpdateSetup,
	PromptKitUpdateSpinner,
} from "./types.js";
import { isBetaVersion } from "./version-comparator.js";

const execAsync = promisify(exec);

// Only allow alphanumeric chars and hyphens in provider names (defense-in-depth against injection)
const SAFE_PROVIDER_NAME = /^[a-z0-9-]+$/;
const HOOK_DEPENDENCY_EXTENSIONS = [".js", ".cjs", ".mjs", ".json"];

// ─── Kit selection ────────────────────────────────────────────────────────────

/**
 * Determine which kit to update based on installation state.
 * Implements fallback logic:
 *   - Only global: prefer globalKits, fallback to localKits
 *   - Only local: prefer localKits, fallback to globalKits
 *   - Both: prefer global, with fallbacks
 * @internal Exported for testing
 */
export function selectKitForUpdate(params: KitSelectionParams): KitSelectionResult | null {
	const { hasLocal, hasGlobal, localKits, globalKits } = params;

	const hasLocalKit = localKits.length > 0 || hasLocal;
	const hasGlobalKit = globalKits.length > 0 || hasGlobal;

	if (!hasLocalKit && !hasGlobalKit) return null;

	if (hasGlobalKit && !hasLocalKit) {
		const kit = globalKits[0] || localKits[0];
		return {
			isGlobal: true,
			kit,
			promptMessage: `Update global ClaudeKit content${kit ? ` (${kit})` : ""}?`,
		};
	}

	if (hasLocalKit && !hasGlobalKit) {
		const kit = localKits[0] || globalKits[0];
		return {
			isGlobal: false,
			kit,
			promptMessage: `Update local project ClaudeKit content${kit ? ` (${kit})` : ""}?`,
		};
	}

	// Both installed — prefer global
	const kit = globalKits[0] || localKits[0];
	return {
		isGlobal: true,
		kit,
		promptMessage: `Update global ClaudeKit content${kit ? ` (${kit})` : ""}?`,
	};
}

// ─── Metadata helpers ─────────────────────────────────────────────────────────

/**
 * Read full metadata from .claude directory to get kit information.
 * Uses Zod schema validation to ensure data integrity.
 * @internal Exported for testing
 */
export async function readMetadataFile(claudeDir: string): Promise<Metadata | null> {
	const metadataPath = join(claudeDir, "metadata.json");
	try {
		if (!(await pathExists(metadataPath))) return null;
		const content = await readFile(metadataPath, "utf-8");
		const parsed = JSON.parse(content);
		const validated = MetadataSchema.safeParse(parsed);
		if (!validated.success) {
			logger.verbose(`Invalid metadata format: ${validated.error.message}`);
			return null;
		}
		return validated.data;
	} catch (error) {
		logger.verbose(
			`Failed to read metadata: ${error instanceof Error ? error.message : "unknown"}`,
		);
		return null;
	}
}

// ─── Init command builder ─────────────────────────────────────────────────────

/**
 * Build init command with appropriate flags for kit type.
 * @internal Exported for testing
 */
export function buildInitCommand(
	isGlobal: boolean,
	kit?: KitType,
	beta?: boolean,
	yes?: boolean,
	restoreCkHooks?: boolean,
): string {
	const parts = ["ck init"];
	if (isGlobal) parts.push("-g");
	if (kit) parts.push(`--kit ${kit}`);
	if (yes) parts.push("--yes");
	if (restoreCkHooks) parts.push("--restore-ck-hooks");
	parts.push("--install-skills");
	if (beta) parts.push("--beta");
	return parts.join(" ");
}

export function resolveCkExecutable(platformName: NodeJS.Platform = process.platform): string {
	return platformName === "win32" ? "ck.cmd" : "ck";
}

export function shouldRunCkExecutableInShell(
	platformName: NodeJS.Platform = process.platform,
): boolean {
	void platformName;
	return false;
}

export interface CkInitSpawnCommand {
	command: string;
	args: string[];
}

export interface CkInitSpawnCommandOptions {
	execPath?: string;
	argv?: string[];
	platformName?: NodeJS.Platform;
}

export function resolveCkInitSpawnCommand(
	initArgs: string[],
	options: CkInitSpawnCommandOptions = {},
): CkInitSpawnCommand {
	const execPath = options.execPath ?? process.execPath;
	const argv = options.argv ?? process.argv;
	const currentEntrypoint = argv[1];

	if (currentEntrypoint) {
		return {
			command: execPath,
			args: [currentEntrypoint, ...initArgs],
		};
	}

	return {
		command: resolveCkExecutable(options.platformName),
		args: initArgs,
	};
}

// ─── Latest release tag fetcher ───────────────────────────────────────────────

/**
 * Fetch the latest release tag for a kit from GitHub.
 * Returns null on failure (non-fatal).
 * Note: Kit version (GitHub releases) is separate from CLI version (npm).
 * @internal Exported for testing
 */
export async function fetchLatestReleaseTag(kit: KitType, beta: boolean): Promise<string | null> {
	try {
		const { GitHubClient } = await import("@/domains/github/github-client.js");
		const github = new GitHubClient();
		const kitConfig = AVAILABLE_KITS[kit];
		const release = await github.getLatestRelease(kitConfig, beta);
		return release.tag_name;
	} catch (error) {
		logger.verbose(
			`Could not fetch latest release tag: ${error instanceof Error ? error.message : "unknown"}`,
		);
		return null;
	}
}

// ─── promptKitUpdate (Step 2) ─────────────────────────────────────────────────

/** Optional dependencies for promptKitUpdate (testing) */
export interface PromptKitUpdateDeps {
	execAsyncFn?: ExecAsyncFn;
	/** Spawn ck init with inherited stdio for interactive mode. Returns exit code. */
	spawnInitFn?: (args: string[]) => Promise<number>;
	getSetupFn?: (projectDir?: string) => Promise<PromptKitUpdateSetup>;
	spinnerFn?: () => PromptKitUpdateSpinner;
	/** Override for fetching latest release tag (testing) */
	getLatestReleaseTagFn?: (kit: KitType, beta: boolean) => Promise<string | null>;
	loadFullConfigFn?: PromptKitUpdateConfigLoader;
	confirmFn?: PromptKitUpdateConfirmFn;
	isCancelFn?: PromptKitUpdateCancelFn;
	findMissingHookDependenciesFn?: (claudeDir: string) => Promise<string[]>;
	countMissingHookFileReferencesFn?: (projectDir: string) => Promise<number>;
}

async function findMissingHookDependencies(claudeDir: string): Promise<string[]> {
	const hooksDir = join(claudeDir, "hooks");
	if (!existsSync(hooksDir)) return [];

	const files = await readdir(hooksDir);
	const cjsFiles = files.filter((file) => file.endsWith(".cjs"));
	const missing: string[] = [];
	const nodeBuiltins = new Set([
		...builtinModules,
		...builtinModules.map((name) => `node:${name}`),
	]);

	for (const file of cjsFiles) {
		const content = await readFile(join(hooksDir, file), "utf8");
		const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
		for (let match = requireRegex.exec(content); match; match = requireRegex.exec(content)) {
			const depPath = match[1];
			if (!depPath || nodeBuiltins.has(depPath) || !depPath.startsWith(".")) continue;
			const resolvedPath = join(hooksDir, depPath);
			const exists =
				existsSync(resolvedPath) ||
				HOOK_DEPENDENCY_EXTENSIONS.some((ext) => existsSync(resolvedPath + ext)) ||
				existsSync(join(resolvedPath, "index.js")) ||
				existsSync(join(resolvedPath, "index.cjs")) ||
				existsSync(join(resolvedPath, "index.mjs"));
			if (!exists) missing.push(`${file}: ${depPath}`);
		}
	}

	return missing;
}

/**
 * Step 2 of the update pipeline: prompt to update kit content.
 * Detects installed kits and offers to run appropriate init commands.
 * @param beta - Whether to include --beta flag
 * @param yes - Whether to skip confirmation prompt (non-interactive mode)
 */
export async function promptKitUpdate(
	beta?: boolean,
	yes?: boolean,
	deps?: PromptKitUpdateDeps,
): Promise<void> {
	try {
		const execFn = deps?.execAsyncFn ?? (execAsync as ExecAsyncFn);
		const loadFullConfigFn = deps?.loadFullConfigFn ?? CkConfigManager.loadFull;
		const confirmFn = deps?.confirmFn ?? confirm;
		const isCancelFn = deps?.isCancelFn ?? isCancel;
		const getSetupFn = deps?.getSetupFn ?? getClaudeKitSetup;
		const findMissingHookDepsFn =
			deps?.findMissingHookDependenciesFn ?? findMissingHookDependencies;
		const setup = await getSetupFn();
		const hasLocal = !!setup.project.metadata;
		const hasGlobal = !!setup.global.metadata;

		const localMetadata = hasLocal ? await readMetadataFile(setup.project.path) : null;
		const globalMetadata = hasGlobal ? await readMetadataFile(setup.global.path) : null;

		const localKits = localMetadata ? getInstalledKits(localMetadata) : [];
		const globalKits = globalMetadata ? getInstalledKits(globalMetadata) : [];

		let selection = selectKitForUpdate({ hasLocal, hasGlobal, localKits, globalKits });

		if (!selection) {
			logger.verbose("No ClaudeKit installations detected, skipping kit update prompt");
			return;
		}

		let forceKitReinstall = false;
		if (hasLocal && setup.project.path) {
			try {
				const missingHookDeps = await findMissingHookDepsFn(setup.project.path);
				if (missingHookDeps.length > 0) {
					logger.warning(
						`Detected ${missingHookDeps.length} local missing hook dependency(ies); reinstalling local kit content`,
					);
					forceKitReinstall = true;
				}
			} catch (error) {
				logger.verbose(
					`Local hook dependency self-heal check skipped: ${
						error instanceof Error ? error.message : "unknown"
					}`,
				);
			}

			try {
				const countMissingHookRefsFn =
					deps?.countMissingHookFileReferencesFn ?? countMissingHookFileReferences;
				const missingHookRefs = await countMissingHookRefsFn(dirname(setup.project.path));
				if (missingHookRefs > 0) {
					logger.warning(
						`Detected ${missingHookRefs} local broken hook registration(s); reinstalling local kit content`,
					);
					forceKitReinstall = true;
				}
			} catch (error) {
				logger.verbose(
					`Local hook registration self-heal check skipped: ${
						error instanceof Error ? error.message : "unknown"
					}`,
				);
			}

			if (forceKitReinstall && selection.isGlobal) {
				const kit = localKits[0] || selection.kit;
				selection = {
					isGlobal: false,
					kit,
					promptMessage: `Update local project ClaudeKit content${kit ? ` (${kit})` : ""}?`,
				};
			}
		}

		let kitVersion = selection.kit
			? selection.isGlobal
				? globalMetadata?.kits?.[selection.kit]?.version
				: localMetadata?.kits?.[selection.kit]?.version
			: undefined;
		const isBetaInstalled = isBetaVersion(kitVersion);

		const promptMessage = selection.promptMessage;

		if (selection.kit && kitVersion) {
			logger.info(`Current kit version: ${selection.kit}@${kitVersion}`);
		}

		// Version check in --yes mode: skip reinstall when already at latest
		let alreadyAtLatest = false;
		if (yes && selection.kit && kitVersion && !forceKitReinstall) {
			const getTagFn = deps?.getLatestReleaseTagFn ?? fetchLatestReleaseTag;
			const latestTag = await getTagFn(selection.kit, beta || isBetaInstalled);
			if (latestTag && versionsMatch(kitVersion, latestTag)) {
				alreadyAtLatest = true;
			} else if (latestTag) {
				logger.info(`Kit update available: ${kitVersion} -> ${latestTag}`);
			}
		}

		if (alreadyAtLatest) {
			try {
				const claudeDir = selection.isGlobal ? setup.global.path : setup.project.path;
				const missingHookDeps = claudeDir ? await findMissingHookDepsFn(claudeDir) : [];
				if (missingHookDeps.length > 0) {
					logger.warning(
						`Detected ${missingHookDeps.length} missing hook dependency(ies); reinstalling kit content`,
					);
					alreadyAtLatest = false;
					forceKitReinstall = true;
				}
			} catch (error) {
				logger.verbose(
					`Hook dependency self-heal check skipped: ${
						error instanceof Error ? error.message : "unknown"
					}`,
				);
			}
		}

		if (alreadyAtLatest) {
			try {
				const countMissingHookRefsFn =
					deps?.countMissingHookFileReferencesFn ?? countMissingHookFileReferences;
				const projectDir = setup.project.path ? dirname(setup.project.path) : process.cwd();
				const missingHookRefs = await countMissingHookRefsFn(projectDir);
				if (missingHookRefs > 0) {
					logger.warning(
						`Detected ${missingHookRefs} broken hook registration(s); reinstalling kit content`,
					);
					alreadyAtLatest = false;
					forceKitReinstall = true;

					// A project-local settings.json that points at missing project hooks must be
					// repaired by a local ck init, even when a global kit also exists.
					if (setup.project.path && selection.isGlobal) {
						selection = {
							isGlobal: false,
							kit: localKits[0] || selection.kit,
							promptMessage: `Update local project ClaudeKit content${
								localKits[0] || selection.kit ? ` (${localKits[0] || selection.kit})` : ""
							}?`,
						};
						kitVersion = selection.kit ? localMetadata?.kits?.[selection.kit]?.version : undefined;
					}
				}
			} catch (error) {
				logger.verbose(
					`Hook registration self-heal check skipped: ${
						error instanceof Error ? error.message : "unknown"
					}`,
				);
			}
		}

		// Check autoInitAfterUpdate config
		let autoInit = false;
		try {
			const ckConfig = await loadFullConfigFn(null);
			autoInit = ckConfig.config.updatePipeline?.autoInitAfterUpdate ?? false;
		} catch {
			// Non-fatal — fall back to manual prompt
		}

		if (alreadyAtLatest && !autoInit) {
			logger.success(
				`Already at latest version (${selection.kit}@${kitVersion}), skipping reinstall`,
			);
			return;
		}

		// Prompt user unless --yes, autoInit, or already at latest
		if (!yes && !autoInit) {
			logger.info("");
			const shouldUpdate = await confirmFn({ message: promptMessage });
			if (isCancelFn(shouldUpdate) || !shouldUpdate) {
				log.info("Skipped kit content update");
				return;
			}
		} else if (autoInit && !yes) {
			logger.info("Auto-running kit update (updatePipeline.autoInitAfterUpdate is enabled)");
		} else {
			logger.verbose("Auto-proceeding with kit update (--yes flag)");
		}

		const useBeta = beta || isBetaInstalled;

		if (yes) {
			// Non-interactive: exec with pre-selected kit + spinner
			const initCmd = buildInitCommand(
				selection.isGlobal,
				selection.kit,
				useBeta,
				true,
				forceKitReinstall,
			);
			logger.info(`Running: ${initCmd}`);
			const s = (deps?.spinnerFn ?? spinner)();
			s.start("Updating ClaudeKit content...");

			try {
				await execFn(initCmd, { timeout: 300000 });

				let newKitVersion: string | undefined;
				try {
					const claudeDir = selection.isGlobal ? setup.global.path : setup.project.path;
					const updatedMetadata = await readMetadataFile(claudeDir);
					newKitVersion = selection.kit
						? updatedMetadata?.kits?.[selection.kit]?.version
						: undefined;
				} catch {
					// version info unavailable
				}

				if (selection.kit && kitVersion && newKitVersion && kitVersion !== newKitVersion) {
					s.stop(`Kit updated: ${selection.kit}@${kitVersion} -> ${newKitVersion}`);
				} else if (selection.kit && newKitVersion) {
					s.stop(`Kit content updated (${selection.kit}@${newKitVersion})`);
				} else {
					s.stop("Kit content updated");
				}
			} catch (error) {
				s.stop("Kit update finished");
				const errorMsg = error instanceof Error ? error.message : "unknown";
				if (errorMsg.includes("exit code") && !errorMsg.includes("exit code 0")) {
					logger.warning("Kit content update may have encountered issues");
					logger.verbose(`Error: ${errorMsg}`);
				} else {
					logger.verbose(`Init command completed: ${errorMsg}`);
				}
			}
		} else {
			// Interactive: spawn ck init with inherited stdio
			const args = ["init"];
			if (selection.isGlobal) args.push("-g");
			if (forceKitReinstall) args.push("--restore-ck-hooks");
			args.push("--install-skills");
			if (useBeta) args.push("--beta");

			const displayCmd = `ck ${args.join(" ")}`;
			logger.info(`Running: ${displayCmd}`);

			const spawnFn =
				deps?.spawnInitFn ??
				((spawnArgs: string[]) =>
					new Promise<number>((resolve) => {
						const initCommand = resolveCkInitSpawnCommand(spawnArgs);
						const child = spawn(initCommand.command, initCommand.args, { stdio: "inherit" });
						child.on("close", (code) => resolve(code ?? 1));
						child.on("error", (err) => {
							logger.verbose(`Failed to spawn ck init: ${err.message}`);
							resolve(1);
						});
					}));

			const exitCode = await spawnFn(args);
			if (exitCode !== 0) {
				logger.warning("Kit content update may have encountered issues");
			}
		}
	} catch (error) {
		// Non-fatal: log warning and continue
		logger.verbose(
			`Failed to prompt for kit update: ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}

// ─── promptMigrateUpdate (Step 3) ────────────────────────────────────────────

/** Optional dependencies for promptMigrateUpdate (testing) */
export interface PromptMigrateUpdateDeps {
	detectInstalledProvidersFn?: () => Promise<string[]>;
	getProviderConfigFn?: (provider: string) => { displayName: string };
	getSetupFn?: (projectDir?: string) => Promise<PromptKitUpdateSetup>;
	loadFullConfigFn?: PromptKitUpdateConfigLoader;
	execAsyncFn?: ExecAsyncFn;
	repairHookFileReferencesFn?: (projectDir: string) => Promise<number>;
	repairLegacyHookPromptsFn?: (projectDir: string) => Promise<number>;
	cleanupMigratedHooksFn?: (
		providers: string[],
		options: { global: boolean },
	) => Promise<
		Array<{ hooksPruned: number; filesRemoved: number; registryEntriesRemoved: number }>
	>;
}

export { repairLegacyHookPrompts, repairMissingHookFileReferences };

/**
 * Step 3 of the update pipeline: independently check and run migration.
 * Detects installed providers and runs ck migrate if autoMigrateAfterUpdate is configured.
 * Runs independently of whether kit update (step 2) executed.
 */
export async function promptMigrateUpdate(deps?: PromptMigrateUpdateDeps): Promise<void> {
	try {
		const repairFn = deps?.repairHookFileReferencesFn ?? repairMissingHookFileReferences;
		const repairLegacyPromptsFn = deps?.repairLegacyHookPromptsFn ?? repairLegacyHookPrompts;
		const repairLegacyHookPromptsSafely = async () => {
			try {
				const repaired = await repairLegacyPromptsFn(process.cwd());
				if (repaired > 0) {
					logger.info(`Pruned ${repaired} legacy hook prompt(s)`);
				}
			} catch (error) {
				logger.verbose(
					`Legacy hook prompt repair skipped: ${
						error instanceof Error ? error.message : "unknown"
					}`,
				);
			}
		};
		const repairHookFileReferencesSafely = async () => {
			try {
				const repaired = await repairFn(process.cwd());
				if (repaired > 0) {
					logger.info(`Repaired ${repaired} missing hook file reference(s)`);
				}
			} catch (error) {
				logger.verbose(
					`Hook file reference repair skipped: ${error instanceof Error ? error.message : "unknown"}`,
				);
			}
		};

		await repairLegacyHookPromptsSafely();
		await repairHookFileReferencesSafely();

		const providerRegistry =
			deps?.detectInstalledProvidersFn && deps?.getProviderConfigFn
				? null
				: await import("@/commands/portable/provider-registry.js");
		const detectFn =
			deps?.detectInstalledProvidersFn ??
			(providerRegistry?.detectInstalledProviders as () => Promise<string[]>);
		const getConfigFn =
			deps?.getProviderConfigFn ??
			(providerRegistry?.getProviderConfig as (p: string) => { displayName: string });
		const getSetupFn = deps?.getSetupFn ?? getClaudeKitSetup;
		const loadFullConfigFn = deps?.loadFullConfigFn ?? CkConfigManager.loadFull;
		const execFn = deps?.execAsyncFn ?? (execAsync as ExecAsyncFn);

		if (!detectFn || !getConfigFn) return;

		// Detect installed providers. Claude Code is the source install, not a
		// migration target; cleaning it as a migrated provider would remove current CK
		// hooks immediately after update self-heal restores them.
		const allProviders = await detectFn();
		if (allProviders.length === 0) {
			logger.verbose("No migration providers detected, skipping migrate step");
			return;
		}

		// Auto-detect global vs local install before cleanup/migration.
		let isGlobal = false;
		try {
			const setup = await getSetupFn();
			isGlobal = !!setup.global.metadata && !setup.project.metadata;
		} catch {
			// Non-fatal — default to local
		}

		try {
			const cleanupFn =
				deps?.cleanupMigratedHooksFn ??
				(await import("@/commands/portable/migrated-hooks-cleanup.js"))
					.cleanupMigratedHooksForProviders;
			const cleanupProviders = allProviders.filter(
				(p) => p !== "claude-code" && SAFE_PROVIDER_NAME.test(p),
			);
			if (cleanupProviders.length > 0) {
				const cleanupResults = await cleanupFn(cleanupProviders, { global: isGlobal });
				const cleanupCount = cleanupResults.reduce(
					(total, result) =>
						total + result.hooksPruned + result.filesRemoved + result.registryEntriesRemoved,
					0,
				);
				if (cleanupCount > 0) {
					logger.info(`Cleaned up ${cleanupCount} generated-context hook artifact(s)`);
				}

				await repairLegacyHookPromptsSafely();
				await repairHookFileReferencesSafely();
			}
		} catch (error) {
			logger.verbose(
				`Migrated hook cleanup skipped: ${error instanceof Error ? error.message : "unknown"}`,
			);
		}

		const targets = allProviders.filter((p) => p !== "claude-code");
		if (targets.length === 0) {
			logger.verbose("No migration targets detected, skipping migrate step");
			return;
		}

		let autoMigrate = false;
		let migrateProviders: "auto" | string[] = "auto";
		let migrateScope: MigrateScopeConfig | undefined;
		try {
			const ckConfig = await loadFullConfigFn(null);
			const pipeline = ckConfig.config.updatePipeline;
			autoMigrate = pipeline?.autoMigrateAfterUpdate ?? false;
			migrateProviders = pipeline?.migrateProviders ?? "auto";
			migrateScope = pipeline?.migrateScope;
		} catch {
			// Non-fatal
		}

		// Skip if user hasn't opted in — --yes alone doesn't trigger migration
		if (!autoMigrate) return;

		let providers: string[];
		if (migrateProviders === "auto") {
			providers = targets;
		} else if (Array.isArray(migrateProviders)) {
			const invalid = migrateProviders.filter((p) => !targets.includes(p));
			if (invalid.length > 0) {
				logger.warning(`Unknown/uninstalled providers in migrateProviders: ${invalid.join(", ")}`);
			}
			providers = migrateProviders.filter((p) => targets.includes(p));
		} else {
			return;
		}

		if (providers.length === 0) return;

		// Validate provider names (defense-in-depth against shell injection)
		const safeProviders = providers.filter((p) => SAFE_PROVIDER_NAME.test(p));
		if (safeProviders.length !== providers.length) {
			logger.warning("Some provider names contain invalid characters and were skipped");
		}
		if (safeProviders.length === 0) return;

		const providerNames = safeProviders.map((p) => getConfigFn(p).displayName).join(", ");

		const parts = ["ck", "migrate"];
		if (isGlobal) parts.push("-g");
		for (const p of safeProviders) {
			parts.push("--agent", p);
		}
		// Translate persisted migrateScope into --skip-X flags. Only emit when the
		// user has explicitly set a type to false; absent/true entries leave the
		// existing default (migrate everything) untouched.
		if (migrateScope) {
			if (migrateScope.agents === false) parts.push("--skip-agents");
			if (migrateScope.commands === false) parts.push("--skip-commands");
			if (migrateScope.skills === false) parts.push("--skip-skills");
			if (migrateScope.config === false) parts.push("--skip-config");
			if (migrateScope.rules === false) parts.push("--skip-rules");
			if (migrateScope.hooks === false) parts.push("--skip-hooks");
		}
		parts.push("--yes");
		const cmd = parts.join(" ");

		logger.info(`Auto-migrating to: ${providerNames}`);

		try {
			await execFn(cmd, { timeout: 300000 });
			logger.success("Auto-migration complete");
		} catch (error) {
			logger.warning(
				`Auto-migration failed: ${error instanceof Error ? error.message : "unknown"}. Run \`ck migrate\` manually to retry.`,
			);
		}
	} catch (error) {
		// Non-fatal: migrate step is best-effort
		logger.verbose(`Migrate step skipped: ${error instanceof Error ? error.message : "unknown"}`);
	}
}
