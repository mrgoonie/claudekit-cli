/**
 * Update CLI Command
 * Updates the ClaudeKit CLI package to the latest version
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { NpmRegistryClient } from "@/domains/github/npm-registry.js";
import { PackageManagerDetector } from "@/domains/installation/package-manager-detector.js";
import { VersionChecker } from "@/domains/versioning/version-checker.js";
import { getClaudeKitSetup } from "@/services/file-operations/claudekit-scanner.js";
import { logger } from "@/shared/logger.js";
import { confirm, intro, isCancel, log, note, outro, spinner } from "@/shared/safe-prompts.js";
import { ClaudeKitError } from "@/types";
import { type UpdateCliOptions, UpdateCliOptionsSchema } from "@/types";
import { compareVersions } from "compare-versions";
import picocolors from "picocolors";
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
 * Display kit update reminder after CLI operations
 * Warns users that ck update only updates the CLI, not the kit content
 */
async function displayKitUpdateReminder(): Promise<void> {
	const setup = await getClaudeKitSetup();
	const hasLocal = !!setup.project.metadata;
	const hasGlobal = !!setup.global.metadata;

	// Build info message
	const lines: string[] = [];
	lines.push(picocolors.yellow("Note: 'ck update' only updates the CLI tool itself."));
	lines.push("");
	lines.push("To update your ClaudeKit content (skills, commands, workflows):");

	if (hasLocal) {
		const localVersion = setup.project.metadata?.version || "unknown";
		lines.push(`  ${picocolors.cyan("ck init")}         Update local project (v${localVersion})`);

		// Check if local kit has updates available
		const localCheck = await VersionChecker.check(localVersion).catch(() => null);
		if (localCheck?.updateAvailable) {
			lines.push(
				`                  ${picocolors.green(`→ v${localCheck.latestVersion} available!`)}`,
			);
		}
	} else {
		lines.push(`  ${picocolors.cyan("ck init")}         Initialize in current project`);
	}

	if (hasGlobal) {
		const globalVersion = setup.global.metadata?.version || "unknown";
		lines.push(
			`  ${picocolors.cyan("ck init -g")}      Update global ~/.claude (v${globalVersion})`,
		);

		// Check if global kit has updates available
		const globalCheck = await VersionChecker.check(globalVersion).catch(() => null);
		if (globalCheck?.updateAvailable) {
			lines.push(
				`                  ${picocolors.green(`→ v${globalCheck.latestVersion} available!`)}`,
			);
		}
	} else {
		lines.push(`  ${picocolors.cyan("ck init -g")}      Initialize global ~/.claude`);
	}

	// Display the reminder
	console.log();
	log.info(lines.join("\n"));
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
			await displayKitUpdateReminder();
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
			await displayKitUpdateReminder();
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
			await displayKitUpdateReminder();
		} catch {
			s.stop("Verification completed");
			outro(`[+] Update completed. Please restart your terminal to use CLI ${targetVersion}`);
			await displayKitUpdateReminder();
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
