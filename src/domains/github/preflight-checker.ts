/**
 * Pre-flight checks for GitHub CLI before kit access detection
 * Validates gh CLI installation, version, and authentication
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@/shared/logger.js";
import {
	GH_COMMAND_TIMEOUT_MS,
	MIN_GH_CLI_VERSION,
	compareVersions,
	getGhUpgradeInstructions,
	shouldSkipExpensiveOperations,
} from "./gh-cli-utils.js";

const execAsync = promisify(exec);

export interface PreflightResult {
	success: boolean;
	ghInstalled: boolean;
	ghVersion: string | null;
	ghVersionOk: boolean;
	ghAuthenticated: boolean;
	errorLines: string[];
}

/**
 * Run pre-flight checks for GitHub CLI before attempting kit access detection
 * @returns PreflightResult with success status and error details
 */
export async function runPreflightChecks(): Promise<PreflightResult> {
	logger.debug("Running GitHub CLI pre-flight checks");

	// Early return in test/CI environments where gh may not be available
	if (process.env.NODE_ENV === "test" || shouldSkipExpensiveOperations()) {
		logger.debug("Skipping preflight checks in test/CI environment");
		return {
			success: true,
			ghInstalled: true,
			ghVersion: MIN_GH_CLI_VERSION,
			ghVersionOk: true,
			ghAuthenticated: true,
			errorLines: [],
		};
	}

	const result: PreflightResult = {
		success: false,
		ghInstalled: false,
		ghVersion: null,
		ghVersionOk: false,
		ghAuthenticated: false,
		errorLines: [],
	};

	// Step 1: Check if gh is installed
	try {
		const { stdout } = await execAsync("gh --version", { timeout: GH_COMMAND_TIMEOUT_MS });
		const match = stdout.match(/(\d+\.\d+\.\d+)/);
		result.ghVersion = match?.[1] ?? null;
		result.ghInstalled = true;

		logger.debug(`GitHub CLI detected: v${result.ghVersion}`);
	} catch (error) {
		logger.debug(
			`GitHub CLI not found: ${error instanceof Error ? error.message : "unknown error"}`,
		);
		result.errorLines.push("✗ GitHub CLI not installed");
		result.errorLines.push("  Install from: https://cli.github.com");
		result.errorLines.push("");
		result.errorLines.push("After install: gh auth login -h github.com");
		return result;
	}

	// Step 2: Check version meets minimum requirement
	if (result.ghVersion) {
		const comparison = compareVersions(result.ghVersion, MIN_GH_CLI_VERSION);
		result.ghVersionOk = comparison >= 0;

		if (!result.ghVersionOk) {
			logger.debug(`GitHub CLI version ${result.ghVersion} is below minimum ${MIN_GH_CLI_VERSION}`);
			result.errorLines.push(...getGhUpgradeInstructions(result.ghVersion));
			return result;
		}
	}

	// Step 3: Check authentication status
	try {
		// Run gh auth status with explicit github.com host
		// Exit code 0 = authenticated, non-zero = not authenticated
		await execAsync("gh auth status -h github.com", {
			timeout: GH_COMMAND_TIMEOUT_MS,
			// Suppress stderr output which contains the status message
			env: { ...process.env, GH_NO_UPDATE_NOTIFIER: "1" },
		});
		result.ghAuthenticated = true;
		logger.debug("GitHub CLI authenticated for github.com");
	} catch (error) {
		logger.debug(
			`GitHub CLI not authenticated: ${error instanceof Error ? error.message : "unknown error"}`,
		);
		result.errorLines.push("✗ GitHub CLI not authenticated");
		result.errorLines.push("  Run: gh auth login -h github.com");
		return result;
	}

	// All checks passed
	result.success = true;
	logger.debug("All GitHub CLI pre-flight checks passed");
	return result;
}
