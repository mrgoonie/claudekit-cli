/**
 * Update CLI Command
 * Updates the ClaudeKit CLI package to the latest version
 */

import { exec } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { NpmRegistryClient, redactRegistryUrlForLog } from "@/domains/github/npm-registry.js";
import { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import { getInstalledKits } from "@/domains/migration/metadata-migration.js";
import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { CLAUDEKIT_CLI_NPM_PACKAGE_NAME } from "@/shared/claudekit-constants.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, note, outro, spinner } from "@/shared/safe-prompts.js";
import { ClaudeKitError } from "@/types";
import {
	type KitType,
	type Metadata,
	MetadataSchema,
	type UpdateCliOptions,
	UpdateCliOptionsSchema,
} from "@/types";
import { compareVersions } from "compare-versions";
import { pathExists, readFile } from "fs-extra";
import packageInfo from "../../package.json" assert { type: "json" };

const execAsync = promisify(exec);

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
export function buildInitCommand(isGlobal: boolean, kit?: KitType, beta?: boolean): string {
	const parts = ["ck init"];
	if (isGlobal) parts.push("-g");
	if (kit) parts.push(`--kit ${kit}`);
	parts.push("--yes --install-skills");
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
	if (!version) return false;
	return /-(beta|alpha|rc|dev)[.\d]/i.test(version);
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
export async function promptKitUpdate(beta?: boolean, yes?: boolean): Promise<void> {
	try {
		const setup = await getClaudeKitSetup();
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

		const initCmd = buildInitCommand(selection.isGlobal, selection.kit, beta || isBetaInstalled);
		const promptMessage = selection.promptMessage;

		// Prompt user (skip if --yes flag)
		if (!yes) {
			logger.info("");
			const shouldUpdate = await confirm({
				message: promptMessage,
			});

			if (isCancel(shouldUpdate) || !shouldUpdate) {
				log.info("Skipped kit content update");
				return;
			}
		} else {
			logger.verbose("Auto-proceeding with kit update (--yes flag)");
		}

		// Execute the init command
		logger.info(`Running: ${initCmd}`);
		const s = spinner();
		s.start("Updating ClaudeKit content...");

		try {
			await execAsync(initCmd, {
				timeout: 300000, // 5 minute timeout for init
			});
			s.stop("Kit content updated");
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

/**
 * Update CLI command - updates the ClaudeKit CLI package itself
 */
export async function updateCliCommand(options: UpdateCliOptions): Promise<void> {
	const s = spinner();

	intro("[>] ClaudeKit CLI - Update");

	try {
		// Validate and parse options
		const opts = UpdateCliOptionsSchema.parse(options);

		// Get current CLI version
		const currentVersion = packageInfo.version;
		logger.info(`Current CLI version: ${currentVersion}`);

		// Detect package manager
		s.start("Detecting package manager...");
		const pm = await PackageManagerDetector.detect();
		const pmVersion = await PackageManagerDetector.getVersion(pm);
		s.stop(
			`Using ${PackageManagerDetector.getDisplayName(pm)}${pmVersion ? ` v${pmVersion}` : ""}`,
		);
		logger.verbose(`Detected package manager: ${pm}`);

		// Resolve the registry URL: user-provided --registry > user's npm config > default
		// This ensures version checks and install commands use the same registry
		let registryUrl = opts.registry;
		if (!registryUrl && pm === "npm") {
			const userRegistry = await PackageManagerDetector.getNpmRegistryUrl();
			if (userRegistry) {
				registryUrl = userRegistry;
				logger.verbose(`Using npm configured registry: ${redactRegistryUrlForLog(registryUrl)}`);
			}
		}

		// Fetch target version from npm registry
		s.start("Checking for updates...");
		let targetVersion: string | null = null;

		if (opts.release && opts.release !== "latest") {
			// Specific version requested
			try {
				const exists = await NpmRegistryClient.versionExists(
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
		} else if (opts.dev || opts.beta) {
			// Dev version requested (--dev or --beta alias)
			targetVersion = await NpmRegistryClient.getDevVersion(
				CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
				registryUrl,
			);
			if (!targetVersion) {
				s.stop("No dev version available");
				logger.warning("No dev version found. Using latest stable version instead.");
				targetVersion = await NpmRegistryClient.getLatestVersion(
					CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
					registryUrl,
				);
			} else {
				s.stop(`Latest dev version: ${targetVersion}`);
			}
		} else {
			// Latest stable version
			targetVersion = await NpmRegistryClient.getLatestVersion(
				CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
				registryUrl,
			);
			s.stop(`Latest version: ${targetVersion || "unknown"}`);
		}

		// Handle failure to fetch version
		if (!targetVersion) {
			throw new CliUpdateError(
				`Failed to fetch version information from npm registry. Check your internet connection and try again. Manual update: ${PackageManagerDetector.getUpdateCommand(pm, CLAUDEKIT_CLI_NPM_PACKAGE_NAME, undefined, registryUrl)}`,
			);
		}

		// Compare versions
		const comparison = compareVersions(currentVersion, targetVersion);

		if (comparison === 0) {
			outro(`[+] Already on the latest CLI version (${currentVersion})`);
			await promptKitUpdate(opts.dev || opts.beta, opts.yes);
			return;
		}

		// When --dev/--beta is used, treat prerelease as an upgrade even if semver says otherwise
		// Semver considers 3.31.0 > 3.31.0-dev.3, but user explicitly wants dev channel
		const isDevChannelSwitch =
			(opts.dev || opts.beta) && isBetaVersion(targetVersion) && !isBetaVersion(currentVersion);

		if (comparison > 0 && !opts.release && !isDevChannelSwitch) {
			// Current version is newer (edge case with beta/local versions)
			outro(`[+] Current version (${currentVersion}) is newer than latest (${targetVersion})`);
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
			await promptKitUpdate(opts.dev || opts.beta, opts.yes);
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
		const updateCmd = PackageManagerDetector.getUpdateCommand(
			pm,
			CLAUDEKIT_CLI_NPM_PACKAGE_NAME,
			targetVersion,
			registryUrl,
		);
		logger.info(`Running: ${redactCommandForLog(updateCmd)}`);

		s.start("Updating CLI...");

		try {
			await execAsync(updateCmd, {
				timeout: 120000, // 2 minute timeout
			});

			// Verify installation after update
			try {
				const verifyResult = await execAsync("ck --version", { timeout: 5000 });
				if (!verifyResult.stdout.includes(targetVersion)) {
					throw new CliUpdateError("Version verification failed after update");
				}
			} catch (verifyError) {
				logger.warning("Could not verify installation automatically");
			}

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
			const { stdout } = await execAsync("ck --version", { timeout: 5000 });
			const newVersionMatch = stdout.match(/CLI Version:\s*(\S+)/);
			const newVersion = newVersionMatch ? newVersionMatch[1] : targetVersion;
			s.stop(`Installed version: ${newVersion}`);

			// Success message
			outro(`[+] Successfully updated ClaudeKit CLI to ${newVersion}`);
			await promptKitUpdate(opts.dev || opts.beta, opts.yes);
		} catch {
			s.stop("Verification completed");
			outro(`[+] Update completed. Please restart your terminal to use CLI ${targetVersion}`);
			await promptKitUpdate(opts.dev || opts.beta, opts.yes);
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
