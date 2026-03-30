/**
 * Update CLI Command
 * Updates the ClaudeKit CLI package to the latest version
 */

import { exec } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { CkConfigManager } from "@/domains/config/ck-config-manager.js";
import { NpmRegistryClient, redactRegistryUrlForLog } from "@/domains/github/npm-registry.js";
import { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import { getInstalledKits } from "@/domains/migration/metadata-migration.js";
import { isPrereleaseVersion, versionsMatch } from "@/domains/versioning/checking/version-utils.js";
import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, note, outro, spinner } from "@/shared/safe-prompts.js";
import { ClaudeKitError } from "@/types";
import {
	AVAILABLE_KITS,
	type KitType,
	type Metadata,
	MetadataSchema,
	type UpdateCliOptions,
	UpdateCliOptionsSchema,
} from "@/types";
import { compareVersions } from "compare-versions";
import { pathExists, readFile } from "fs-extra";
import packageInfo from "../../package.json" assert { type: "json" };
import type { UpdatePipelineConfig } from "../types/ck-config.js";

const execAsync = promisify(exec);

type ExecAsyncResult = { stdout?: string; stderr?: string } | string;
type ExecAsyncFn = (command: string, options?: { timeout?: number }) => Promise<ExecAsyncResult>;

type UpdateCliPackageManagerDetector = Pick<
	typeof PackageManagerDetector,
	"detect" | "getVersion" | "getDisplayName" | "getNpmRegistryUrl" | "getUpdateCommand"
>;

type UpdateCliNpmRegistryClient = Pick<
	typeof NpmRegistryClient,
	"versionExists" | "getDevVersion" | "getLatestVersion"
>;

type PromptKitUpdateSetup = {
	global: {
		path: string;
		metadata: { kits?: Record<string, { version?: string }> } | null;
		components: {
			commands: number;
			hooks: number;
			skills: number;
			workflows: number;
			settings: number;
		};
	};
	project: {
		path: string;
		metadata: { kits?: Record<string, { version?: string }> } | null;
		components: {
			commands: number;
			hooks: number;
			skills: number;
			workflows: number;
			settings: number;
		};
	};
};

type PromptKitUpdateConfigLoader = (
	projectDir: string | null,
) => Promise<{ config: { updatePipeline?: Partial<UpdatePipelineConfig> } }>;

type PromptKitUpdateConfirmFn = (opts: { message: string }) => Promise<boolean | symbol>;
type PromptKitUpdateCancelFn = (value: unknown) => boolean;
type PromptKitUpdateSpinner = {
	start: (msg?: string) => void;
	stop: (msg?: string, code?: number) => void;
	message: (msg?: string) => void;
};

export interface UpdateCliCommandDeps {
	currentVersion: string;
	execAsyncFn: ExecAsyncFn;
	packageManagerDetector: UpdateCliPackageManagerDetector;
	npmRegistryClient: UpdateCliNpmRegistryClient;
	promptKitUpdateFn: typeof promptKitUpdate;
	promptMigrateUpdateFn: () => Promise<void>;
}

function getDefaultUpdateCliCommandDeps(): UpdateCliCommandDeps {
	return {
		currentVersion: packageInfo.version,
		execAsyncFn: execAsync as ExecAsyncFn,
		packageManagerDetector: PackageManagerDetector,
		npmRegistryClient: NpmRegistryClient,
		promptKitUpdateFn: promptKitUpdate,
		promptMigrateUpdateFn: promptMigrateUpdate,
	};
}

function extractCommandStdout(result: ExecAsyncResult): string {
	if (typeof result === "string") {
		return result;
	}
	if (result && typeof result.stdout === "string") {
		return result.stdout;
	}
	return "";
}

/**
 * CLI Update Error
 * Thrown when CLI update fails
 */
export class CliUpdateError extends ClaudeKitError {
	constructor(message: string) {
		super(message, "CLI_UPDATE_ERROR");
		this.name = "CliUpdateError";
	}
}

/**
 * Redact sensitive command arguments for logging/output safety.
 * @internal Exported for testing
 */
export function redactCommandForLog(command: string): string {
	if (!command) return command;

	const redactedRegistryFlags = command.replace(
		/(--registry(?:=|\s+))(['"]?)(\S+?)(\2)(?=\s|$)/g,
		(_match, prefix: string, quote: string, url: string) =>
			`${prefix}${quote}${redactRegistryUrlForLog(url)}${quote}`,
	);

	// Fallback for any inline URL with embedded credentials.
	return redactedRegistryFlags.replace(/https?:\/\/[^\s"']+/g, (url) =>
		redactRegistryUrlForLog(url),
	);
}

/**
 * Build init command with appropriate flags for kit type
 * @internal Exported for testing
 */
export function buildInitCommand(
	isGlobal: boolean,
	kit?: KitType,
	beta?: boolean,
	yes?: boolean,
): string {
	const parts = ["ck init"];
	if (isGlobal) parts.push("-g");
	if (kit) parts.push(`--kit ${kit}`);
	if (yes) parts.push("--yes");
	parts.push("--install-skills");
	if (beta) parts.push("--beta");
	return parts.join(" ");
}

/**
 * Detect if a version string indicates a prerelease (beta, alpha, rc, or dev).
 * Matches semver prerelease patterns followed by separator or digit.
 * @param version - Version string to check (e.g., "v2.3.0-beta.17", "3.30.0-dev.2")
 * @returns true if version contains prerelease identifier
 * @internal Exported for testing
 */
export function isBetaVersion(version: string | undefined): boolean {
	return isPrereleaseVersion(version);
}

/**
 * Parse CLI version from `ck --version` output.
 * Returns null when output does not contain a recognizable version line.
 * @internal Exported for testing
 */
export function parseCliVersionFromOutput(output: string): string | null {
	if (!output) return null;
	const match = output.match(/CLI Version:\s*(\S+)/);
	return match ? match[1] : null;
}

/**
 * Kit selection parameters for determining which kit to update
 */
export interface KitSelectionParams {
	hasLocal: boolean;
	hasGlobal: boolean;
	localKits: KitType[];
	globalKits: KitType[];
}

/**
 * Kit selection result with init command configuration
 */
export interface KitSelectionResult {
	isGlobal: boolean;
	kit: KitType | undefined;
	promptMessage: string;
}

/**
 * Determine which kit to update based on installation state.
 * Implements fallback logic:
 * - Only global: prefer globalKits, fallback to localKits
 * - Only local: prefer localKits, fallback to globalKits
 * - Both: prefer global, with fallbacks
 * @internal Exported for testing
 */
export function selectKitForUpdate(params: KitSelectionParams): KitSelectionResult | null {
	const { hasLocal, hasGlobal, localKits, globalKits } = params;

	// Determine if we have local or global kit installed
	const hasLocalKit = localKits.length > 0 || hasLocal;
	const hasGlobalKit = globalKits.length > 0 || hasGlobal;

	// If no kits installed, return null
	if (!hasLocalKit && !hasGlobalKit) {
		return null;
	}

	if (hasGlobalKit && !hasLocalKit) {
		// Only global kit installed - fallback to localKits if globalKits empty
		const kit = globalKits[0] || localKits[0];
		return {
			isGlobal: true,
			kit,
			promptMessage: `Update global ClaudeKit content${kit ? ` (${kit})` : ""}?`,
		};
	}

	if (hasLocalKit && !hasGlobalKit) {
		// Only local kit installed - fallback to globalKits if localKits empty
		const kit = localKits[0] || globalKits[0];
		return {
			isGlobal: false,
			kit,
			promptMessage: `Update local project ClaudeKit content${kit ? ` (${kit})` : ""}?`,
		};
	}

	// Both installed - prefer global with fallback
	const kit = globalKits[0] || localKits[0];
	return {
		isGlobal: true,
		kit,
		promptMessage: `Update global ClaudeKit content${kit ? ` (${kit})` : ""}?`,
	};
}

/**
 * Read full metadata from .claude directory to get kit information
 * Uses Zod schema validation to ensure data integrity
 * @internal Exported for testing
 */
export async function readMetadataFile(claudeDir: string): Promise<Metadata | null> {
	const metadataPath = join(claudeDir, "metadata.json");
	try {
		if (!(await pathExists(metadataPath))) {
			return null;
		}
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

/**
 * Prompt user to update kit content after CLI update.
 * Detects installed kits and offers to run appropriate init commands.
 * @param beta - Whether to include --beta flag in init commands
 * @param yes - Whether to skip confirmation prompt (non-interactive mode)
 * @internal Exported for testing
 */
/** Optional dependencies for promptKitUpdate (testing) */
export interface PromptKitUpdateDeps {
	execAsyncFn?: (command: string, options?: { timeout?: number }) => Promise<ExecAsyncResult>;
	getSetupFn?: (projectDir?: string) => Promise<PromptKitUpdateSetup>;
	spinnerFn?: () => PromptKitUpdateSpinner;
	/** Override for fetching latest release tag (testing) */
	getLatestReleaseTagFn?: (kit: KitType, beta: boolean) => Promise<string | null>;
	loadFullConfigFn?: PromptKitUpdateConfigLoader;
	confirmFn?: PromptKitUpdateConfirmFn;
	isCancelFn?: PromptKitUpdateCancelFn;
}

/**
 * Fetch the latest release tag for a kit from GitHub.
 * Returns null if the fetch fails (non-fatal).
 * Note: This makes a GitHub API call because the kit version (from GitHub releases) is
 * separate from the CLI version (from npm registry). The npm targetVersion resolved earlier
 * in updateCliCommand cannot be reused here — they track different version lines.
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
		const setup = await getSetupFn();
		const hasLocal = !!setup.project.metadata;
		const hasGlobal = !!setup.global.metadata;

		// Read full metadata to detect installed kits
		const localMetadata = hasLocal ? await readMetadataFile(setup.project.path) : null;
		const globalMetadata = hasGlobal ? await readMetadataFile(setup.global.path) : null;

		// Get installed kits for each scope
		const localKits = localMetadata ? getInstalledKits(localMetadata) : [];
		const globalKits = globalMetadata ? getInstalledKits(globalMetadata) : [];

		// Select which kit to update using extracted logic
		const selection = selectKitForUpdate({ hasLocal, hasGlobal, localKits, globalKits });

		// If no kits installed, skip prompt
		if (!selection) {
			logger.verbose("No ClaudeKit installations detected, skipping kit update prompt");
			return;
		}

		// Detect if existing installation is a prerelease (beta/alpha/rc) from version string
		const kitVersion = selection.kit
			? selection.isGlobal
				? globalMetadata?.kits?.[selection.kit]?.version
				: localMetadata?.kits?.[selection.kit]?.version
			: undefined;
		const isBetaInstalled = isBetaVersion(kitVersion);

		const promptMessage = selection.promptMessage;

		// Show current kit version before update
		if (selection.kit && kitVersion) {
			logger.info(`Current kit version: ${selection.kit}@${kitVersion}`);
		}

		// Check if kit is already at latest version (--yes mode only)
		let alreadyAtLatest = false;
		if (yes && selection.kit && kitVersion) {
			const getTagFn = deps?.getLatestReleaseTagFn ?? fetchLatestReleaseTag;
			const latestTag = await getTagFn(selection.kit, beta || isBetaInstalled);
			if (latestTag && versionsMatch(kitVersion, latestTag)) {
				logger.success(
					`Already at latest version (${selection.kit}@${kitVersion}), skipping reinstall`,
				);
				alreadyAtLatest = true;
			} else if (latestTag) {
				logger.info(`Kit update available: ${kitVersion} -> ${latestTag}`);
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

		// Skip init when kit is at latest and auto-init is not configured
		if (alreadyAtLatest && !autoInit) {
			return;
		}

		// Prompt user (skip if --yes flag, autoInit config, or already checked version)
		if (!yes && !autoInit) {
			logger.info("");
			const shouldUpdate = await confirmFn({
				message: promptMessage,
			});

			if (isCancelFn(shouldUpdate) || !shouldUpdate) {
				log.info("Skipped kit content update");
				return;
			}
		} else if (autoInit && !yes) {
			logger.info("Auto-running kit update (updatePipeline.autoInitAfterUpdate is enabled)");
		} else {
			logger.verbose("Auto-proceeding with kit update (--yes flag)");
		}

		// Build init command — only pass --yes when user explicitly used -y or autoInit is enabled
		const initCmd = buildInitCommand(
			selection.isGlobal,
			selection.kit,
			beta || isBetaInstalled,
			yes || autoInit,
		);

		// Execute the init command
		logger.info(`Running: ${initCmd}`);
		const s = (deps?.spinnerFn ?? spinner)();
		s.start("Updating ClaudeKit content...");

		try {
			await execFn(initCmd, {
				timeout: 300000, // 5 minute timeout for init
			});

			// Non-fatal: best-effort version resolution
			let newKitVersion: string | undefined;
			try {
				const claudeDir = selection.isGlobal ? setup.global.path : setup.project.path;
				const updatedMetadata = await readMetadataFile(claudeDir);
				newKitVersion = selection.kit ? updatedMetadata?.kits?.[selection.kit]?.version : undefined;
			} catch {
				// version info unavailable, fall through to generic message
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

			// Check if it's a real error vs clean exit
			if (errorMsg.includes("exit code") && !errorMsg.includes("exit code 0")) {
				logger.warning("Kit content update may have encountered issues");
				logger.verbose(`Error: ${errorMsg}`);
			} else {
				// Non-fatal: init command may have printed its own output or exited cleanly
				logger.verbose(`Init command completed: ${errorMsg}`);
			}
		}
	} catch (error) {
		// Non-fatal: log warning and continue
		logger.verbose(
			`Failed to prompt for kit update: ${error instanceof Error ? error.message : "unknown error"}`,
		);
	}
}

// Only allow alphanumeric chars and hyphens in provider names (defense-in-depth against injection)
const SAFE_PROVIDER_NAME = /^[a-z0-9-]+$/;

/** Optional dependencies for promptMigrateUpdate (testing) */
export interface PromptMigrateUpdateDeps {
	detectInstalledProvidersFn?: () => Promise<string[]>;
	getProviderConfigFn?: (provider: string) => { displayName: string };
	getSetupFn?: (projectDir?: string) => Promise<PromptKitUpdateSetup>;
	loadFullConfigFn?: PromptKitUpdateConfigLoader;
	execAsyncFn?: (command: string, options?: { timeout?: number }) => Promise<ExecAsyncResult>;
}

/**
 * Step 3 of the update pipeline: independently check and run migration.
 * Detects installed providers and runs ck migrate if autoMigrateAfterUpdate is configured.
 * Runs independently of whether kit update (step 2) executed.
 */
export async function promptMigrateUpdate(deps?: PromptMigrateUpdateDeps): Promise<void> {
	try {
		// Lazy-import portable modules to avoid circular deps
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

		// Detect installed providers (excludes claude-code — it's the source, not a target)
		const allProviders = await detectFn();
		const targets = allProviders.filter((p) => p !== "claude-code");
		if (targets.length === 0) {
			logger.verbose("No migration targets detected, skipping migrate step");
			return;
		}

		// Load config to check autoMigrateAfterUpdate
		let autoMigrate = false;
		let migrateProviders: "auto" | string[] = "auto";
		try {
			const ckConfig = await loadFullConfigFn(null);
			const pipeline = ckConfig.config.updatePipeline;
			autoMigrate = pipeline?.autoMigrateAfterUpdate ?? false;
			migrateProviders = pipeline?.migrateProviders ?? "auto";
		} catch {
			// Non-fatal
		}

		// Skip if user hasn't opted in — --yes alone doesn't trigger migration
		if (!autoMigrate) return;

		// Resolve which providers to migrate
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

		// Auto-detect global vs local install (same detection as promptKitUpdate)
		let isGlobal = false;
		try {
			const setup = await getSetupFn();
			isGlobal = !!setup.global.metadata && !setup.project.metadata;
		} catch {
			// Non-fatal — default to local
		}

		const providerNames = safeProviders.map((p) => getConfigFn(p).displayName).join(", ");

		const parts = ["ck", "migrate"];
		if (isGlobal) parts.push("-g");
		for (const p of safeProviders) {
			parts.push("--agent", p);
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

/**
 * Update CLI command - updates the ClaudeKit CLI package itself
 */
export async function updateCliCommand(
	options: UpdateCliOptions,
	deps: UpdateCliCommandDeps = getDefaultUpdateCliCommandDeps(),
): Promise<void> {
	const s = spinner();

	intro("[>] ClaudeKit CLI - Update");

	try {
		const {
			currentVersion,
			execAsyncFn,
			packageManagerDetector,
			npmRegistryClient,
			promptKitUpdateFn,
			promptMigrateUpdateFn,
		} = deps;

		// Validate and parse options
		const opts = UpdateCliOptionsSchema.parse(options);

		// Get current CLI version
		logger.info(`Current CLI version: ${currentVersion}`);

		// Detect package manager
		s.start("Detecting package manager...");
		const pm = await packageManagerDetector.detect();
		const pmVersion = await packageManagerDetector.getVersion(pm);
		s.stop(
			`Using ${packageManagerDetector.getDisplayName(pm)}${pmVersion ? ` v${pmVersion}` : ""}`,
		);
		logger.verbose(`Detected package manager: ${pm}`);

		// Resolve the registry URL: user-provided --registry > user's npm config > default
		// This ensures version checks and install commands use the same registry
		let registryUrl = opts.registry;
		if (!registryUrl && pm === "npm") {
			const userRegistry = await packageManagerDetector.getNpmRegistryUrl();
			if (userRegistry) {
				registryUrl = userRegistry;
				logger.verbose(`Using npm configured registry: ${redactRegistryUrlForLog(registryUrl)}`);
			}
		}

		// Fetch target version from npm registry
		s.start("Checking for updates...");
		let targetVersion: string | null = null;
		const preferInstalledPrereleaseChannel =
			!opts.release && !(opts.dev || opts.beta) && isPrereleaseVersion(currentVersion);
		const usePrereleaseChannel = opts.dev || opts.beta || preferInstalledPrereleaseChannel;

		if (opts.release && opts.release !== "latest") {
			// Specific version requested
			try {
				const exists = await npmRegistryClient.versionExists(
					CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
					opts.release,
					registryUrl,
				);
				if (!exists) {
					s.stop("Version not found");
					throw new CliUpdateError(
						`Version ${opts.release} does not exist on npm registry. Run 'ck versions' to see available versions.`,
					);
				}
			} catch (error) {
				if (error instanceof CliUpdateError) {
					throw error;
				}
				s.stop("Version check failed");
				const message = error instanceof Error ? error.message : "Unknown error";
				logger.verbose(`Release check failed for ${opts.release}: ${message}`);
				const registryHint = registryUrl
					? ` (${redactRegistryUrlForLog(registryUrl)})`
					: " (default registry)";
				throw new CliUpdateError(
					`Failed to verify version ${opts.release} on npm registry${registryHint}. Check registry settings/network connectivity and try again.`,
				);
			}
			targetVersion = opts.release;
			s.stop(`Target version: ${targetVersion}`);
		} else if (usePrereleaseChannel) {
			// Prerelease version requested explicitly or inferred from current install channel
			targetVersion = await npmRegistryClient.getDevVersion(
				CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
				registryUrl,
			);
			if (!targetVersion) {
				s.stop("No dev version available");
				logger.warning("No dev version found. Using latest stable version instead.");
				targetVersion = await npmRegistryClient.getLatestVersion(
					CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
					registryUrl,
				);
			} else {
				s.stop(`Latest dev version: ${targetVersion}`);
			}
		} else {
			// Latest stable version
			targetVersion = await npmRegistryClient.getLatestVersion(
				CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
				registryUrl,
			);
			s.stop(`Latest version: ${targetVersion || "unknown"}`);
		}

		// Handle failure to fetch version
		if (!targetVersion) {
			throw new CliUpdateError(
				`Failed to fetch version information from npm registry. Check your internet connection and try again. Manual update: ${packageManagerDetector.getUpdateCommand(pm, CLAUDEKIT_CLI_NPM_PACKAGE_NAME, undefined, registryUrl)}`,
			);
		}

		// Compare versions
		const comparison = compareVersions(currentVersion, targetVersion);
		const targetIsPrerelease = isPrereleaseVersion(targetVersion);

		if (comparison === 0) {
			outro(`[+] Already on the latest CLI version (${currentVersion})`);
			await promptKitUpdateFn(targetIsPrerelease, opts.yes);
			await promptMigrateUpdateFn();
			return;
		}

		// When --dev/--beta is used, treat prerelease as an upgrade even if semver says otherwise
		// Semver considers 3.31.0 > 3.31.0-dev.3, but user explicitly wants dev channel
		const isDevChannelSwitch =
			(opts.dev || opts.beta) && isBetaVersion(targetVersion) && !isBetaVersion(currentVersion);

		if (comparison > 0 && !opts.release && !isDevChannelSwitch) {
			// Current version is newer (edge case with beta/local versions)
			outro(`[+] Current version (${currentVersion}) is newer than latest (${targetVersion})`);
			await promptKitUpdateFn(targetIsPrerelease, opts.yes);
			await promptMigrateUpdateFn();
			return;
		}

		// Display version change
		// Dev channel switch is always an upgrade (user explicitly wants dev)
		const isUpgrade = comparison < 0 || isDevChannelSwitch;
		const changeType = isUpgrade ? "upgrade" : "downgrade";
		logger.info(
			`${isUpgrade ? "[^]" : "[v]"}  ${changeType}: ${currentVersion} -> ${targetVersion}`,
		);

		// --check flag: just show info and exit
		if (opts.check) {
			note(
				`CLI update available: ${currentVersion} -> ${targetVersion}\n\nRun 'ck update' to install`,
				"Update Check",
			);
			await promptKitUpdateFn(targetIsPrerelease, opts.yes);
			await promptMigrateUpdateFn();
			outro("Check complete");
			return;
		}

		// Confirmation prompt (unless --yes flag)
		if (!opts.yes) {
			const shouldUpdate = await confirm({
				message: `${isUpgrade ? "Update" : "Downgrade"} CLI from ${currentVersion} to ${targetVersion}?`,
			});

			if (isCancel(shouldUpdate) || !shouldUpdate) {
				outro("Update cancelled");
				return;
			}
		}

		// Execute update — pass registryUrl to ensure npm install uses the same registry we checked
		const updateCmd = packageManagerDetector.getUpdateCommand(
			pm,
			CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
			targetVersion,
			registryUrl,
		);
		logger.info(`Running: ${redactCommandForLog(updateCmd)}`);

		s.start("Updating CLI...");

		try {
			await execAsyncFn(updateCmd, {
				timeout: 120000, // 2 minute timeout
			});
			s.stop("Update completed");
		} catch (error) {
			s.stop("Update failed");

			const errorMessage = error instanceof Error ? error.message : "Unknown error";

			// Check for common permission errors
			if (
				errorMessage.includes("EACCES") ||
				errorMessage.includes("EPERM") ||
				errorMessage.includes("permission") ||
				errorMessage.includes("Access is denied")
			) {
				const permHint =
					pm === "npm"
						? "\n\nOr fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally"
						: "";
				const isWindows = process.platform === "win32";
				const elevationHint = isWindows
					? `Run your terminal as Administrator and retry: ${updateCmd}`
					: `sudo ${updateCmd}`;
				throw new CliUpdateError(`Permission denied. Try: ${elevationHint}${permHint}`);
			}

			// Provide helpful recovery message
			logger.error(`Update failed: ${errorMessage}`);
			logger.info(`Try running: ${redactCommandForLog(updateCmd)}`);
			throw new CliUpdateError(`Update failed: ${errorMessage}\n\nManual update: ${updateCmd}`);
		}

		// Verify installation
		s.start("Verifying installation...");
		try {
			const versionResult = await execAsyncFn("ck --version", { timeout: 5000 });
			const stdout = extractCommandStdout(versionResult);
			const activeVersion = parseCliVersionFromOutput(stdout);
			if (!activeVersion) {
				s.stop("Verification failed");
				const message = `Update completed but could not parse 'ck --version' output.
Please restart your terminal and run 'ck --version'. Expected: ${targetVersion}

Manual update: ${redactCommandForLog(updateCmd)}`;
				logger.error(message);
				throw new CliUpdateError(message);
			}

			s.stop(`Installed version: ${activeVersion}`);

			if (activeVersion !== targetVersion) {
				const mismatchMessage = `Update did not activate the requested version.
Expected: ${targetVersion}
Active ck: ${activeVersion}

Likely causes: multiple global installations (npm/bun/pnpm/yarn) or stale shell shim/cache (common on Windows).
Run '${redactCommandForLog(updateCmd)}' manually, restart terminal, then check command resolution:
- Windows: where ck
- macOS/Linux: which -a ck`;
				logger.error(mismatchMessage);
				throw new CliUpdateError(mismatchMessage);
			}

			// Success message
			outro(`[+] Successfully updated ClaudeKit CLI to ${activeVersion}`);
			await promptKitUpdateFn(targetIsPrerelease, opts.yes);
			await promptMigrateUpdateFn();
		} catch (error) {
			if (error instanceof CliUpdateError) {
				throw error;
			}
			s.stop("Verification failed");
			const message = `Update completed but automatic verification failed.
Please restart your terminal and run 'ck --version'. Expected: ${targetVersion}

Manual update: ${redactCommandForLog(updateCmd)}`;
			logger.error(message);
			throw new CliUpdateError(message);
		}
	} catch (error) {
		if (error instanceof CliUpdateError) {
			// Already logged by the inner catch — just re-throw without duplicate logging
			throw error;
		}
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Update failed: ${errorMessage}`);
		throw new CliUpdateError(errorMessage);
	}
}
