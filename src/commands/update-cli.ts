/**
 * Update CLI Command
 * Updates the ClaudeKit CLI package to the latest version
 */

import { exec } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { NpmRegistryClient } from "@/domains/github/npm-registry.js";
import { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import { getInstalledKits } from "@/domains/migration/metadata-migration.js";
import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, note, outro, spinner } from "@/shared/safe-prompts.js";
import { ClaudeKitError } from "@/types";
import {
	type KitType,
	type Metadata,
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

// Package name for claudekit-cli
const PACKAGE_NAME = "claudekit-cli";

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
 * Read full metadata from .claude directory to get kit information
 */
async function readMetadataFile(claudeDir: string): Promise<Metadata | null> {
	const metadataPath = join(claudeDir, "metadata.json");
	try {
		if (!(await pathExists(metadataPath))) {
			return null;
		}
		const content = await readFile(metadataPath, "utf-8");
		return JSON.parse(content) as Metadata;
	} catch {
		return null;
	}
}

/**
 * Prompt user to update kit content after CLI update.
 * Detects installed kits and offers to run appropriate init commands.
 * @param beta - Whether to include --beta flag in init commands
 */
async function promptKitUpdate(beta?: boolean): Promise<void> {
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

		// Determine if we have local or global kit installed
		const hasLocalKit = localKits.length > 0 || hasLocal;
		const hasGlobalKit = globalKits.length > 0 || hasGlobal;

		// If no kits installed, skip prompt
		if (!hasLocalKit && !hasGlobalKit) {
			logger.verbose("No ClaudeKit installations detected, skipping kit update prompt");
			return;
		}

		// Build the init command based on what's installed
		let initCmd: string;
		let promptMessage: string;

		if (hasGlobalKit && !hasLocalKit) {
			// Only global kit installed
			const kit = globalKits[0];
			initCmd = buildInitCommand(true, kit, beta);
			promptMessage = `Update global ClaudeKit content${kit ? ` (${kit})` : ""}?`;
		} else if (hasLocalKit && !hasGlobalKit) {
			// Only local kit installed
			const kit = localKits[0];
			initCmd = buildInitCommand(false, kit, beta);
			promptMessage = `Update local project ClaudeKit content${kit ? ` (${kit})` : ""}?`;
		} else {
			// Both installed - prefer global
			const kit = globalKits[0] || localKits[0];
			initCmd = buildInitCommand(true, kit, beta);
			promptMessage = `Update global ClaudeKit content${kit ? ` (${kit})` : ""}?`;
		}

		// Prompt user
		logger.info("");
		const shouldUpdate = await confirm({
			message: promptMessage,
		});

		if (isCancel(shouldUpdate) || !shouldUpdate) {
			log.info("Skipped kit content update");
			return;
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
			s.stop("Kit update completed");
			// Non-fatal: init command may have printed its own output
			logger.verbose(
				`Init command result: ${error instanceof Error ? error.message : "completed"}`,
			);
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

		// Fetch target version from npm registry
		s.start("Checking for updates...");
		let targetVersion: string | null = null;

		if (opts.release && opts.release !== "latest") {
			// Specific version requested
			const exists = await NpmRegistryClient.versionExists(
				PACKAGE_NAME,
				opts.release,
				opts.registry,
			);
			if (!exists) {
				s.stop("Version not found");
				throw new CliUpdateError(
					`Version ${opts.release} does not exist on npm registry. Run 'ck versions' to see available versions.`,
				);
			}
			targetVersion = opts.release;
			s.stop(`Target version: ${targetVersion}`);
		} else if (opts.beta) {
			// Beta version requested
			targetVersion = await NpmRegistryClient.getBetaVersion(PACKAGE_NAME, opts.registry);
			if (!targetVersion) {
				s.stop("No beta version available");
				logger.warning("No beta version found. Using latest stable version instead.");
				targetVersion = await NpmRegistryClient.getLatestVersion(PACKAGE_NAME, opts.registry);
			} else {
				s.stop(`Latest beta version: ${targetVersion}`);
			}
		} else {
			// Latest stable version
			targetVersion = await NpmRegistryClient.getLatestVersion(PACKAGE_NAME, opts.registry);
			s.stop(`Latest version: ${targetVersion || "unknown"}`);
		}

		// Handle failure to fetch version
		if (!targetVersion) {
			throw new CliUpdateError(
				`Failed to fetch version information from npm registry. Check your internet connection and try again. Manual update: ${PackageManagerDetector.getUpdateCommand(pm, PACKAGE_NAME)}`,
			);
		}

		// Compare versions
		const comparison = compareVersions(currentVersion, targetVersion);

		if (comparison === 0) {
			outro(`[+] Already on the latest CLI version (${currentVersion})`);
			await promptKitUpdate(opts.beta);
			return;
		}

		if (comparison > 0 && !opts.release) {
			// Current version is newer (edge case with beta/local versions)
			outro(`[+] Current version (${currentVersion}) is newer than latest (${targetVersion})`);
			return;
		}

		// Display version change
		const isUpgrade = comparison < 0;
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
			await promptKitUpdate(opts.beta);
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

		// Execute update
		const updateCmd = PackageManagerDetector.getUpdateCommand(pm, PACKAGE_NAME, targetVersion);
		logger.info(`Running: ${updateCmd}`);

		s.start("Updating CLI...");

		try {
			await execAsync(updateCmd, {
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
				throw new CliUpdateError(
					`Permission denied. Try: sudo ${updateCmd}\n\nOr fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally`,
				);
			}
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
			await promptKitUpdate(opts.beta);
		} catch {
			s.stop("Verification completed");
			outro(`[+] Update completed. Please restart your terminal to use CLI ${targetVersion}`);
			await promptKitUpdate(opts.beta);
		}
	} catch (error) {
		if (error instanceof CliUpdateError) {
			logger.error(error.message);
			throw error;
		}
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Update failed: ${errorMessage}`);
		throw new CliUpdateError(errorMessage);
	}
}
