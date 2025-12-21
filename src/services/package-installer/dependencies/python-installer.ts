/**
 * Python installation logic (pip, python installers)
 */

import type { InstallationMethod } from "@/types";

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
 * Get manual installation instructions for Python
 */
export function getPythonInstructions(osInfo: {
	platform: "darwin" | "linux" | "win32";
	hasApt?: boolean;
	hasDnf?: boolean;
}): string[] {
	const instructions: string[] = ["Visit https://www.python.org/downloads/"];

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

	return instructions;
}
