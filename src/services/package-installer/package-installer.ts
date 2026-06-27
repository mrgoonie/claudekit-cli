/**
 * Package Installer Facade
 *
 * Re-exports all package installation functionality from specialized modules.
 * This file serves as the main entry point for package installation operations.
 */

import { isTestEnvironment } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { AGY_DISPLAY_NAME, installAgy, isAgyInstalled } from "./agy-installer.js";
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

// Re-export Antigravity (agy) installer
export { isAgyInstalled, installAgy, AGY_DISPLAY_NAME } from "./agy-installer.js";

// Re-export skills installer
export {
	installSkillsDependencies,
	handleSkillsInstallation,
	type SkillsInstallOptions,
} from "./skills-installer.js";

/**
 * Check and install packages based on user preferences
 *
 * @param shouldInstallOpenCode - Whether to install OpenCode CLI
 * @param shouldInstallAgy - Whether to install the Antigravity CLI (agy)
 * @param projectDir - Project directory for agy MCP linking (optional)
 */
export async function processPackageInstallations(
	shouldInstallOpenCode: boolean,
	shouldInstallAgy: boolean,
	projectDir?: string,
): Promise<{
	opencode?: PackageInstallResult;
	agy?: PackageInstallResult;
}> {
	const results: {
		opencode?: PackageInstallResult;
		agy?: PackageInstallResult;
	} = {};

	if (shouldInstallOpenCode) {
		if (isTestEnvironment()) {
			results.opencode = {
				success: true,
				package: "OpenCode CLI",
				skipped: true,
			};
		} else {
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
	}

	if (shouldInstallAgy) {
		if (isTestEnvironment()) {
			results.agy = {
				success: true,
				package: AGY_DISPLAY_NAME,
				skipped: true,
			};
		} else {
			const alreadyInstalled = await isAgyInstalled();
			if (alreadyInstalled) {
				logger.info(`${AGY_DISPLAY_NAME} already installed`);
				results.agy = {
					success: true,
					package: AGY_DISPLAY_NAME,
				};
			} else {
				results.agy = await installAgy();
			}

			// Set up agy MCP integration (link .agents/mcp_config.json → .mcp.json)
			// Only run if agy is available (already installed or just installed successfully)
			const agyAvailable = alreadyInstalled || results.agy?.success;
			if (projectDir && agyAvailable) {
				const { processAgyMcpLinking } = await import("./agy-mcp-linker.js");
				await processAgyMcpLinking(projectDir);
			}
		}
	}

	return results;
}
