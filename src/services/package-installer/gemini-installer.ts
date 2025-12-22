import { installPackageGlobally } from "./npm-package-manager.js";
import { execAsync } from "./process-executor.js";
import type { PackageInstallResult } from "./types.js";

/**
 * Check if Google Gemini CLI is installed and accessible in PATH
 * Note: gemini --version can be slow (2-3s), so we use a longer timeout
 */
export async function isGeminiInstalled(): Promise<boolean> {
	try {
		await execAsync("gemini --version", { timeout: 10000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Install Google Gemini CLI package
 */
export async function installGemini(): Promise<PackageInstallResult> {
	return installPackageGlobally("@google/gemini-cli", "Google Gemini CLI");
}
