import { join } from "node:path";
import { isCIEnvironment } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { execAsync, execFileAsync } from "./process-executor.js";
import type { PackageInstallResult } from "./types.js";

/**
 * Check if OpenCode CLI is installed and accessible in PATH
 */
export async function isOpenCodeInstalled(): Promise<boolean> {
	try {
		await execAsync("opencode --version", { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Install OpenCode CLI package using install script
 */
export async function installOpenCode(): Promise<PackageInstallResult> {
	const displayName = "OpenCode CLI";

	// Skip network calls in CI environment
	if (isCIEnvironment()) {
		logger.info("CI environment detected: skipping OpenCode installation");
		return {
			success: false,
			package: displayName,
			error: "Installation skipped in CI environment",
		};
	}

	try {
		logger.info(`Installing ${displayName}...`);

		// Download and execute the official install script safely
		const { unlink } = await import("node:fs/promises");
		const { tmpdir } = await import("node:os");

		const tempScriptPath = join(tmpdir(), "opencode-install.sh");

		try {
			// Download the script first using execFile (no shell interpretation)
			logger.info("Downloading OpenCode installation script...");
			await execFileAsync("curl", ["-fsSL", "https://opencode.ai/install", "-o", tempScriptPath], {
				timeout: 30000, // 30 second timeout for download
			});

			// Make the script executable using execFile
			await execFileAsync("chmod", ["+x", tempScriptPath], {
				timeout: 5000, // 5 second timeout for chmod
			});

			// Execute the downloaded script using execFile
			logger.info("Executing OpenCode installation script...");
			await execFileAsync("bash", [tempScriptPath], {
				timeout: 120000, // 2 minute timeout for installation
			});
		} finally {
			// Clean up the temporary script
			try {
				await unlink(tempScriptPath);
			} catch {
				// Ignore cleanup errors
			}
		}

		// Check if installation was successful by trying to run opencode
		const installed = await isOpenCodeInstalled();
		if (installed) {
			logger.success(`${displayName} installed successfully`);
			return {
				success: true,
				package: displayName,
			};
		}
		return {
			success: false,
			package: displayName,
			error: "Installation completed but opencode command not found in PATH",
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.error(`Failed to install ${displayName}: ${errorMessage}`);

		return {
			success: false,
			package: displayName,
			error: errorMessage,
		};
	}
}
