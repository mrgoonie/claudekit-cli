/**
 * Node.js installation logic
 */

import type { InstallationMethod } from "@/types";

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
 * Get manual installation instructions for Node.js
 */
export function getNodejsInstructions(osInfo: {
	platform: "darwin" | "linux" | "win32";
}): string[] {
	const instructions: string[] = ["Visit https://nodejs.org/"];

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

	return instructions;
}
