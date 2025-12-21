/**
 * Package Installer Facade
 *
 * Re-exports all package installation functionality from specialized modules.
 * This file serves as the main entry point for package installation operations.
 */

import { logger } from "@/shared/logger.js";
import { installGemini, isGeminiInstalled } from "./gemini-installer.js";
import { installOpenCode, isOpenCodeInstalled } from "./opencode-installer.js";
import type { PackageInstallResult } from "./types.js";

// Re-export types
export type { PackageInstallResult } from "./types.js";
export {
	PARTIAL_INSTALL_VERSION,
	EXIT_CODE_CRITICAL_FAILURE,
	EXIT_CODE_PARTIAL_SUCCESS,
} from "./types.js";

// Re-export validators
export { validatePackageName, validateScriptPath } from "./validators.js";

// Re-export process utilities
export {
	executeInteractiveScript,
	getNpmCommand,
	execAsync,
	execFileAsync,
} from "./process-executor.js";

// Re-export npm package manager
export {
	isPackageInstalled,
	getPackageVersion,
	installPackageGlobally,
} from "./npm-package-manager.js";

// Re-export OpenCode installer
export { isOpenCodeInstalled, installOpenCode } from "./opencode-installer.js";

// Re-export Gemini installer
export { isGeminiInstalled, installGemini } from "./gemini-installer.js";

// Re-export skills installer
export { installSkillsDependencies, handleSkillsInstallation } from "./skills-installer.js";

/**
 * Check and install packages based on user preferences
 *
 * @param shouldInstallOpenCode - Whether to install OpenCode CLI
 * @param shouldInstallGemini - Whether to install Gemini CLI
 * @param projectDir - Project directory for Gemini MCP linking (optional)
 */
export async function processPackageInstallations(
	shouldInstallOpenCode: boolean,
	shouldInstallGemini: boolean,
	projectDir?: string,
): Promise<{
	opencode?: PackageInstallResult;
	gemini?: PackageInstallResult;
}> {
	const results: {
		opencode?: PackageInstallResult;
		gemini?: PackageInstallResult;
	} = {};

	if (shouldInstallOpenCode) {
		// Check if opencode is available in PATH
		const alreadyInstalled = await isOpenCodeInstalled();
		if (alreadyInstalled) {
			logger.info("OpenCode CLI already installed");
			results.opencode = {
				success: true,
				package: "OpenCode CLI",
			};
		} else {
			results.opencode = await installOpenCode();
		}
	}

	if (shouldInstallGemini) {
		const alreadyInstalled = await isGeminiInstalled();
		if (alreadyInstalled) {
			logger.info("Google Gemini CLI already installed");
			results.gemini = {
				success: true,
				package: "Google Gemini CLI",
			};
		} else {
			results.gemini = await installGemini();
		}

		// Set up Gemini MCP integration (symlink .gemini/settings.json → .mcp.json)
		// Only run if Gemini is available (already installed or just installed successfully)
		const geminiAvailable = alreadyInstalled || results.gemini?.success;
		if (projectDir && geminiAvailable) {
			const { processGeminiMcpLinking } = await import("./gemini-mcp-linker.js");
			await processGeminiMcpLinking(projectDir);
		}
	}

	return results;
}
