import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * Get the global ClaudeKit installation directory for the current platform
 */
export function getGlobalInstallDir(): string {
	const userHome = homedir();
	const currentPlatform = platform();

	switch (currentPlatform) {
		case "darwin":
			// macOS: ~/.claude/
			return join(userHome, ".claude");

		case "win32": {
			// Windows: %APPDATA%/ClaudeKit/
			// APPDATA environment variable is available on Windows
			const appData = process.env.APPDATA;
			if (appData) {
				return join(appData, "ClaudeKit");
			}
			// Fallback to user home
			return join(userHome, "AppData", "Roaming", "ClaudeKit");
		}
		default:
			// Linux and other platforms: ~/.claude/
			return join(userHome, ".claude");
	}
}

/**
 * Get the platform name for display purposes
 */
export function getPlatformName(): string {
	switch (platform()) {
		case "darwin":
			return "macOS";
		case "win32":
			return "Windows";
		case "linux":
			return "Linux";
		default:
			return platform();
	}
}

/**
 * Check if we have permission to write to the global installation directory
 */
export async function canWriteToGlobalDir(): Promise<boolean> {
	try {
		const fs = await import("fs-extra");
		const globalDir = getGlobalInstallDir();

		// Try to create the directory if it doesn't exist
		await fs.ensureDir(globalDir);

		// Try to write a test file
		const testFile = join(globalDir, ".ck-write-test");
		await fs.writeFile(testFile, "test");
		await fs.remove(testFile);

		return true;
	} catch {
		return false;
	}
}
