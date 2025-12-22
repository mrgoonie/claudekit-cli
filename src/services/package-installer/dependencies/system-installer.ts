/**
 * System packages installation logic (Claude CLI, apt, brew, dnf, pacman)
 */

import { exec } from "node:child_process";
import * as fs from "node:fs";
import { promisify } from "node:util";
import { logger } from "@/shared/logger.js";
import type { InstallationMethod } from "@/types";

const execAsync = promisify(exec);

/**
 * OS information
 */
export interface OSInfo {
	platform: "darwin" | "linux" | "win32";
	distro?: string;
	hasHomebrew?: boolean;
	hasApt?: boolean;
	hasDnf?: boolean;
	hasPacman?: boolean;
}

/**
 * Detect operating system and available package managers
 */
export async function detectOS(): Promise<OSInfo> {
	const platform = process.platform as "darwin" | "linux" | "win32";
	const info: OSInfo = { platform };

	if (platform === "darwin") {
		// Check for Homebrew on macOS
		try {
			await execAsync("which brew");
			info.hasHomebrew = true;
		} catch {
			info.hasHomebrew = false;
		}
	} else if (platform === "linux") {
		// Detect Linux distro from /etc/os-release
		try {
			if (fs.existsSync("/etc/os-release")) {
				const content = fs.readFileSync("/etc/os-release", "utf-8");
				const idMatch = content.match(/^ID=(.+)$/m);
				info.distro = idMatch?.[1]?.replace(/"/g, "");
			}
		} catch (error) {
			logger.debug(`Failed to detect Linux distro: ${error}`);
		}

		// Check for package managers
		try {
			await execAsync("which apt");
			info.hasApt = true;
		} catch {
			info.hasApt = false;
		}

		try {
			await execAsync("which dnf");
			info.hasDnf = true;
		} catch {
			info.hasDnf = false;
		}

		try {
			await execAsync("which pacman");
			info.hasPacman = true;
		} catch {
			info.hasPacman = false;
		}
	}

	return info;
}

/**
 * Installation methods for Claude CLI
 */
export const CLAUDE_INSTALLERS: InstallationMethod[] = [
	{
		name: "Homebrew (macOS)",
		command: "brew install --cask claude-code",
		requiresSudo: false,
		platform: "darwin",
		priority: 1,
		description: "Install via Homebrew (recommended for macOS)",
	},
	{
		name: "Installer Script (Linux)",
		command: "curl -fsSL https://claude.ai/install.sh | bash",
		requiresSudo: false,
		platform: "linux",
		priority: 1,
		description: "Install via official installer script",
	},
	{
		name: "PowerShell (Windows)",
		command: 'powershell -Command "irm https://claude.ai/install.ps1 | iex"',
		requiresSudo: false,
		platform: "win32",
		priority: 1,
		description: "Install via PowerShell script",
	},
];

/**
 * Get manual installation instructions for Claude CLI
 */
export function getClaudeInstructions(osInfo: OSInfo): string[] {
	const instructions: string[] = [
		"Visit https://docs.claude.com/en/docs/claude-code/setup#standard-installation",
	];

	if (osInfo.platform === "darwin") {
		instructions.push("macOS: Download from https://claude.ai/download or use Homebrew:");
		instructions.push("  brew install --cask claude-code");
	} else if (osInfo.platform === "linux") {
		instructions.push("Linux: Run the installer script:");
		instructions.push("  curl -fsSL https://claude.ai/install.sh | bash");
	} else if (osInfo.platform === "win32") {
		instructions.push("Windows: Download installer from https://claude.ai/download");
	}

	return instructions;
}
