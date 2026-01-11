/**
 * Shared GitHub CLI utilities
 * Used by both preflight-checker and system-checker for DRY compliance
 */
import { readFileSync } from "node:fs";
import { logger } from "@/shared/logger.js";

/**
 * Minimum supported GitHub CLI version for ClaudeKit
 * The `gh auth token -h github.com` flag was stabilized around v2.20.0
 * Older versions may have different flag behavior causing auth failures
 */
export const MIN_GH_CLI_VERSION = "2.20.0";

/**
 * Timeout for gh CLI commands in milliseconds
 * 5 seconds balances responsiveness with reliability for local commands
 */
export const GH_COMMAND_TIMEOUT_MS = 5000;

/**
 * Compare semantic versions (e.g., "2.4.0" vs "2.20.0")
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
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
 * Returns false on Windows/macOS or if /proc/version is unreadable
 */
export function isWSL(): boolean {
	// Quick platform check first - only Linux can be WSL
	if (process.platform !== "linux") return false;

	try {
		const release = readFileSync("/proc/version", "utf-8").toLowerCase();
		return release.includes("microsoft") || release.includes("wsl");
	} catch (error) {
		// Expected when /proc/version is unreadable (permission denied, etc.)
		logger.debug(
			`WSL detection skipped: ${error instanceof Error ? error.message : "unknown error"}`,
		);
		return false;
	}
}

/**
 * Check if expensive operations should be skipped (CI without isolated test paths)
 */
export function shouldSkipExpensiveOperations(): boolean {
	// If CK_TEST_HOME is set, we're in an isolated test environment - run the actual tests
	if (process.env.CK_TEST_HOME) {
		return false;
	}
	// Skip in CI or when CI_SAFE_MODE is set (no isolated paths)
	return process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";
}

/**
 * Get platform-specific GitHub CLI upgrade instructions
 */
export function getGhUpgradeInstructions(currentVersion: string): string[] {
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
