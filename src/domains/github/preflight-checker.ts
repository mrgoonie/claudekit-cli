/**
 * Pre-flight checks for GitHub CLI before kit access detection
 * Validates gh CLI installation, version, and authentication
 */
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { logger } from "@/shared/logger.js";

const execAsync = promisify(exec);

/**
 * Minimum supported GitHub CLI version for ClaudeKit
 * The `gh auth token -h github.com` flag was stabilized around v2.20.0
 * Older versions may have different flag behavior causing auth failures
 */
const MIN_GH_CLI_VERSION = "2.20.0";

/**
 * Compare semantic versions (e.g., "2.4.0" vs "2.20.0")
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
	const partsA = a.split(".").map(Number);
	const partsB = b.split(".").map(Number);
	const maxLen = Math.max(partsA.length, partsB.length);

	for (let i = 0; i < maxLen; i++) {
		const numA = partsA[i] ?? 0;
		const numB = partsB[i] ?? 0;
		if (numA < numB) return -1;
		if (numA > numB) return 1;
	}
	return 0;
}

/**
 * Detect if running in Windows Subsystem for Linux (WSL)
 */
function isWSL(): boolean {
	try {
		const release = readFileSync("/proc/version", "utf-8");
		return release.toLowerCase().includes("microsoft") || release.toLowerCase().includes("wsl");
	} catch {
		return false;
	}
}

/**
 * Get platform-specific GitHub CLI upgrade instructions
 */
function getUpgradeInstructions(currentVersion: string): string[] {
	const platform = process.platform;
	const wsl = isWSL();

	const lines: string[] = [];
	lines.push(`✗ GitHub CLI v${currentVersion} is outdated`);
	lines.push(`  Minimum required: v${MIN_GH_CLI_VERSION}`);
	lines.push("");

	if (wsl) {
		// WSL-specific instructions (most common case for old versions)
		lines.push("Upgrade GitHub CLI (WSL/Ubuntu):");
		lines.push(
			"  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg",
		);
		lines.push(
			'  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
		);
		lines.push("  sudo apt update && sudo apt install gh");
	} else if (platform === "darwin") {
		lines.push("Upgrade GitHub CLI:");
		lines.push("  brew upgrade gh");
	} else if (platform === "win32") {
		lines.push("Upgrade GitHub CLI:");
		lines.push("  winget upgrade GitHub.cli");
	} else {
		// Linux (non-WSL)
		lines.push("Upgrade GitHub CLI:");
		lines.push("  sudo apt update && sudo apt upgrade gh");
		lines.push("  Or visit: https://cli.github.com");
	}

	lines.push("");
	lines.push("After upgrade: gh auth login -h github.com");

	return lines;
}

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
		const { stdout } = await execAsync("gh --version", { timeout: 5000 });
		const match = stdout.match(/(\d+\.\d+\.\d+)/);
		result.ghVersion = match?.[1] ?? null;
		result.ghInstalled = true;

		logger.debug(`GitHub CLI detected: v${result.ghVersion}`);
	} catch (error) {
		logger.debug("GitHub CLI not found");
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
			result.errorLines.push(...getUpgradeInstructions(result.ghVersion));
			return result;
		}
	}

	// Step 3: Check authentication status
	try {
		// Run gh auth status with explicit github.com host
		// Exit code 0 = authenticated, non-zero = not authenticated
		await execAsync("gh auth status -h github.com", {
			timeout: 5000,
			// Suppress stderr output which contains the status message
			env: { ...process.env, GH_NO_UPDATE_NOTIFIER: "1" },
		});
		result.ghAuthenticated = true;
		logger.debug("GitHub CLI authenticated for github.com");
	} catch (error) {
		logger.debug("GitHub CLI not authenticated for github.com");
		result.errorLines.push("✗ GitHub CLI not authenticated");
		result.errorLines.push("  Run: gh auth login -h github.com");
		return result;
	}

	// All checks passed
	result.success = true;
	logger.debug("All GitHub CLI pre-flight checks passed");
	return result;
}
