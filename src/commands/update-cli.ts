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
import { type UpdateCliOptions, UpdateCliOptionsSchema } from "../types.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

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

		if (opts.version) {
			// Specific version requested
			const exists = await NpmRegistryClient.versionExists(
				PACKAGE_NAME,
				opts.version,
				opts.registry,
			);
			if (!exists) {
				s.stop("Version not found");
				logger.error(`Version ${opts.version} does not exist on npm registry`);
				logger.info("Run 'ck versions' to see available versions");
				process.exit(1);
			}
			targetVersion = opts.version;
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
			logger.error("Failed to fetch version information from npm registry");
			logger.info("Check your internet connection and try again");
			logger.info(`Manual update: ${PackageManagerDetector.getUpdateCommand(pm, PACKAGE_NAME)}`);
			process.exit(1);
		}

		// Compare versions
		const comparison = compareVersions(currentVersion, targetVersion);

		if (comparison === 0) {
			clack.outro(`✅ Already on the latest version (${currentVersion})`);
			return;
		}

		if (comparison > 0 && !opts.version) {
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
			if (errorMessage.includes("EACCES") || errorMessage.includes("permission")) {
				logger.error("Permission denied. Try running with elevated privileges:");
				logger.info(`  sudo ${updateCmd}`);
				logger.info("");
				logger.info("Or fix npm permissions:");
				logger.info(
					"  https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally",
				);
			} else {
				logger.error(`Update failed: ${errorMessage}`);
				logger.info("");
				logger.info("Manual update:");
				logger.info(`  ${updateCmd}`);
			}

			process.exit(1);
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
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Update failed: ${errorMessage}`);
		process.exit(1);
	}
}
