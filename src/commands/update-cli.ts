/**
 * Update CLI Command
 * Updates the ClaudeKit CLI package to the latest version
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as clack from "@clack/prompts";
import { compareVersions } from "compare-versions";
import packageInfo from "../../package.json" assert { type: "json" };
import { NpmRegistryClient } from "../lib/npm-registry.js";
import { PackageManagerDetector } from "../lib/package-manager-detector.js";
import { ClaudeKitError } from "../types.js";
import { type UpdateCliOptions, UpdateCliOptionsSchema } from "../types.js";
import { logger } from "../utils/logger.js";

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
 * Update CLI command - updates the ClaudeKit CLI package itself
 */
export async function updateCliCommand(options: UpdateCliOptions): Promise<void> {
	const s = clack.spinner();

	clack.intro("🔄 ClaudeKit CLI - Update");

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

		if (opts.release) {
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
			clack.outro(`✅ Already on the latest version (${currentVersion})`);
			return;
		}

		if (comparison > 0 && !opts.release) {
			// Current version is newer (edge case with beta/local versions)
			clack.outro(`✅ Current version (${currentVersion}) is newer than latest (${targetVersion})`);
			return;
		}

		// Display version change
		const isUpgrade = comparison < 0;
		const changeType = isUpgrade ? "upgrade" : "downgrade";
		logger.info(`${isUpgrade ? "⬆️" : "⬇️"}  ${changeType}: ${currentVersion} → ${targetVersion}`);

		// --check flag: just show info and exit
		if (opts.check) {
			clack.note(
				`Update available: ${currentVersion} → ${targetVersion}\n\nRun 'ck update' to install`,
				"Update Check",
			);
			clack.outro("Check complete");
			return;
		}

		// Confirmation prompt (unless --yes flag)
		if (!opts.yes) {
			const shouldUpdate = await clack.confirm({
				message: `${isUpgrade ? "Update" : "Downgrade"} CLI from ${currentVersion} to ${targetVersion}?`,
			});

			if (clack.isCancel(shouldUpdate) || !shouldUpdate) {
				clack.outro("Update cancelled");
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
			clack.outro(`✨ Successfully updated ClaudeKit CLI to ${newVersion}`);
		} catch {
			s.stop("Verification completed");
			clack.outro(`✨ Update completed. Please restart your terminal to use CLI ${targetVersion}`);
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
