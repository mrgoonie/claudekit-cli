import { exec } from "node:child_process";
import * as fs from "node:fs";
import { promisify } from "node:util";
import type { DependencyName, InstallResult, InstallationMethod } from "../types.js";
import { DEPENDENCIES, checkDependency } from "./dependency-checker.js";
import { logger } from "./logger.js";

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
 * Installation methods for Python
 */
export const PYTHON_INSTALLERS: InstallationMethod[] = [
	{
		name: "Homebrew (macOS)",
		command: "brew install python@3.12",
		requiresSudo: false,
		platform: "darwin",
		priority: 1,
		description: "Install Python 3.12 via Homebrew",
	},
	{
		name: "apt (Debian/Ubuntu)",
		command: "sudo apt update && sudo apt install -y python3 python3-pip",
		requiresSudo: true,
		platform: "linux",
		priority: 1,
		description: "Install Python via apt package manager",
	},
	{
		name: "dnf (Fedora/RHEL)",
		command: "sudo dnf install -y python3 python3-pip",
		requiresSudo: true,
		platform: "linux",
		priority: 2,
		description: "Install Python via dnf package manager",
	},
	{
		name: "pacman (Arch)",
		command: "sudo pacman -S --noconfirm python python-pip",
		requiresSudo: true,
		platform: "linux",
		priority: 3,
		description: "Install Python via pacman",
	},
	{
		name: "winget (Windows)",
		command: "winget install Python.Python.3.12",
		requiresSudo: false,
		platform: "win32",
		priority: 1,
		description: "Install Python 3.12 via winget",
	},
];

/**
 * Installation methods for Node.js
 */
export const NODEJS_INSTALLERS: InstallationMethod[] = [
	{
		name: "Homebrew (macOS)",
		command: "brew install node",
		requiresSudo: false,
		platform: "darwin",
		priority: 1,
		description: "Install Node.js via Homebrew",
	},
	{
		name: "NodeSource (Debian/Ubuntu)",
		command:
			"curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs",
		requiresSudo: true,
		platform: "linux",
		priority: 1,
		description: "Install Node.js 20.x via NodeSource",
	},
	{
		name: "dnf (Fedora/RHEL)",
		command: "sudo dnf install -y nodejs npm",
		requiresSudo: true,
		platform: "linux",
		priority: 2,
		description: "Install Node.js via dnf",
	},
	{
		name: "pacman (Arch)",
		command: "sudo pacman -S --noconfirm nodejs npm",
		requiresSudo: true,
		platform: "linux",
		priority: 3,
		description: "Install Node.js via pacman",
	},
	{
		name: "winget (Windows)",
		command: "winget install OpenJS.NodeJS.LTS",
		requiresSudo: false,
		platform: "win32",
		priority: 1,
		description: "Install Node.js LTS via winget",
	},
];

/**
 * Get installation methods for a dependency
 */
export function getInstallerMethods(
	dependency: DependencyName,
	osInfo: OSInfo,
): InstallationMethod[] {
	let installers: InstallationMethod[] = [];

	// Select installer list based on dependency
	switch (dependency) {
		case "claude":
			installers = CLAUDE_INSTALLERS;
			break;
		case "python":
		case "pip":
			installers = PYTHON_INSTALLERS;
			break;
		case "nodejs":
		case "npm":
			installers = NODEJS_INSTALLERS;
			break;
	}

	// Filter by platform
	installers = installers.filter((m) => m.platform === osInfo.platform);

	// Filter by available package managers
	if (osInfo.platform === "darwin" && !osInfo.hasHomebrew) {
		installers = installers.filter((m) => !m.command.includes("brew"));
	} else if (osInfo.platform === "linux") {
		if (!osInfo.hasApt) {
			installers = installers.filter((m) => !m.command.includes("apt"));
		}
		if (!osInfo.hasDnf) {
			installers = installers.filter((m) => !m.command.includes("dnf"));
		}
		if (!osInfo.hasPacman) {
			installers = installers.filter((m) => !m.command.includes("pacman"));
		}
	}

	// Sort by priority
	installers.sort((a, b) => a.priority - b.priority);

	return installers;
}

/**
 * Install a dependency using the first available method
 */
export async function installDependency(
	dependency: DependencyName,
	method?: InstallationMethod,
): Promise<InstallResult> {
	try {
		const osInfo = await detectOS();
		const methods = method ? [method] : getInstallerMethods(dependency, osInfo);

		if (methods.length === 0) {
			return {
				success: false,
				message: `No installation method available for ${dependency} on ${osInfo.platform}`,
			};
		}

		const selectedMethod = methods[0];
		logger.info(`Installing ${dependency} using ${selectedMethod.name}...`);

		if (selectedMethod.requiresSudo) {
			logger.info("⚠️  This installation requires sudo privileges");
		}

		// Execute installation command
		try {
			await execAsync(selectedMethod.command);
		} catch (error) {
			throw new Error(`Installation command failed: ${error}`);
		}

		// Verify installation
		const config =
			DEPENDENCIES[dependency === "pip" ? "python" : dependency === "npm" ? "nodejs" : dependency];
		const status = await checkDependency(config);

		if (status.installed) {
			return {
				success: true,
				message: `Successfully installed ${dependency}`,
				installedVersion: status.version,
			};
		}

		return {
			success: false,
			message: `Installation completed but ${dependency} is still not available`,
		};
	} catch (error) {
		logger.debug(`Installation error: ${error}`);
		return {
			success: false,
			message: error instanceof Error ? error.message : "Unknown installation error",
		};
	}
}

/**
 * Get manual installation instructions
 */
export function getManualInstructions(dependency: DependencyName, osInfo: OSInfo): string[] {
	const instructions: string[] = [];

	switch (dependency) {
		case "claude":
			instructions.push(
				"Visit https://docs.claude.com/en/docs/claude-code/setup#standard-installation",
			);
			if (osInfo.platform === "darwin") {
				instructions.push("macOS: Download from https://claude.ai/download or use Homebrew:");
				instructions.push("  brew install --cask claude-code");
			} else if (osInfo.platform === "linux") {
				instructions.push("Linux: Run the installer script:");
				instructions.push("  curl -fsSL https://claude.ai/install.sh | bash");
			} else if (osInfo.platform === "win32") {
				instructions.push("Windows: Download installer from https://claude.ai/download");
			}
			break;

		case "python":
		case "pip":
			instructions.push("Visit https://www.python.org/downloads/");
			if (osInfo.platform === "darwin") {
				instructions.push("macOS:");
				instructions.push("  brew install python@3.12");
			} else if (osInfo.platform === "linux") {
				instructions.push("Linux:");
				if (osInfo.hasApt) {
					instructions.push("  Ubuntu/Debian:");
					instructions.push("    sudo apt update && sudo apt install python3 python3-pip");
				}
				if (osInfo.hasDnf) {
					instructions.push("  Fedora/RHEL:");
					instructions.push("    sudo dnf install python3 python3-pip");
				}
			} else if (osInfo.platform === "win32") {
				instructions.push("Windows: Download from https://www.python.org/downloads/");
				instructions.push("Make sure to check 'Add Python to PATH' during installation");
			}
			break;

		case "nodejs":
		case "npm":
			instructions.push("Visit https://nodejs.org/");
			if (osInfo.platform === "darwin") {
				instructions.push("macOS:");
				instructions.push("  brew install node");
			} else if (osInfo.platform === "linux") {
				instructions.push("Linux: Use NodeSource repository:");
				instructions.push("  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -");
				instructions.push("  sudo apt-get install -y nodejs");
			} else if (osInfo.platform === "win32") {
				instructions.push("Windows: Download LTS version from https://nodejs.org/");
			}
			break;
	}

	return instructions;
}
