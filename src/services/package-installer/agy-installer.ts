/**
 * Antigravity CLI (agy) installer
 *
 * Google retired the standalone `gemini` CLI (and its `@google/gemini-cli` npm
 * package). Its replacement is the Antigravity CLI, distributed as `agy`.
 *
 * IMPORTANT: `agy` is NOT published to npm. It is installed via Google's official
 * install script:
 *   - Unix/macOS: https://antigravity.google/cli/install.sh  -> ~/.local/bin/agy
 *   - Windows:    https://antigravity.google/cli/install.ps1  -> %LOCALAPPDATA%\agy\bin
 *
 * Detection is done with `agy --version`.
 */

import { join } from "node:path";
import { isCIEnvironment, isWindows } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { execAsync, execFileAsync } from "./process-executor.js";
import type { PackageInstallResult } from "./types.js";

/** User-facing display name for the Antigravity CLI. */
export const AGY_DISPLAY_NAME = "Antigravity CLI (agy)";

const AGY_INSTALL_SH_URL = "https://antigravity.google/cli/install.sh";
const AGY_INSTALL_PS1_URL = "https://antigravity.google/cli/install.ps1";

/**
 * Check if the Antigravity CLI (`agy`) is installed and accessible in PATH.
 *
 * Note: `agy --version` can be slow on first run, so we use a longer timeout
 * (mirrors the previous `gemini --version` behavior).
 */
export async function isAgyInstalled(): Promise<boolean> {
	try {
		await execAsync("agy --version", { timeout: 10000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Download and run the official Unix/macOS install script (install.sh).
 * Downloads to a temp file first, then executes with bash (no piping to shell).
 */
async function installAgyUnix(): Promise<void> {
	const { unlink } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");

	const tempScriptPath = join(tmpdir(), "agy-install.sh");

	try {
		logger.info("Downloading Antigravity CLI installation script...");
		await execFileAsync("curl", ["-fsSL", AGY_INSTALL_SH_URL, "-o", tempScriptPath], {
			timeout: 30000, // 30s for download
		});

		await execFileAsync("chmod", ["+x", tempScriptPath], { timeout: 5000 });

		logger.info("Executing Antigravity CLI installation script...");
		await execFileAsync("bash", [tempScriptPath], {
			timeout: 120000, // 2 minutes for installation
		});
	} finally {
		try {
			await unlink(tempScriptPath);
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Run the official Windows install script (install.ps1) via PowerShell.
 * Matches the repo's existing PowerShell install convention (ExecutionPolicy Bypass).
 */
async function installAgyWindows(): Promise<void> {
	logger.info("Executing Antigravity CLI installation script (PowerShell)...");
	await execFileAsync(
		"powershell.exe",
		["-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", `irm ${AGY_INSTALL_PS1_URL} | iex`],
		{ timeout: 120000 }, // 2 minutes for installation
	);
}

/**
 * Install the Antigravity CLI (`agy`) using Google's official install script.
 *
 * Skipped in CI. On Unix/macOS the binary lands in `~/.local/bin`; on Windows in
 * `%LOCALAPPDATA%\agy\bin`. Either may be absent from the current process PATH,
 * so a successful script run that still fails detection is reported with a clear
 * "restart your shell / fix PATH" message rather than a hard failure.
 */
export async function installAgy(): Promise<PackageInstallResult> {
	const displayName = AGY_DISPLAY_NAME;

	// Skip network calls in CI environment
	if (isCIEnvironment()) {
		logger.info("CI environment detected: skipping Antigravity CLI installation");
		return {
			success: false,
			package: displayName,
			error: "Installation skipped in CI environment",
			skipped: true,
		};
	}

	try {
		logger.info(`Installing ${displayName}...`);

		if (isWindows()) {
			await installAgyWindows();
		} else {
			await installAgyUnix();
		}

		// Verify installation by probing the CLI on PATH.
		const installed = await isAgyInstalled();
		if (installed) {
			logger.success(`${displayName} installed successfully`);
			return {
				success: true,
				package: displayName,
			};
		}

		// The script may have succeeded while the install dir is not yet on PATH.
		const pathHint = isWindows() ? "%LOCALAPPDATA%\\agy\\bin" : "~/.local/bin";
		logger.warning(
			`${displayName} installed, but 'agy' is not on your PATH yet. Restart your shell or add "${pathHint}" to PATH.`,
		);
		return {
			success: false,
			package: displayName,
			error: `Installed but 'agy' not found on PATH. Restart your shell or add "${pathHint}" to PATH.`,
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
