/**
 * Dependency Installer - Facade
 *
 * Handles installation of dependencies (Claude CLI, Python, Node.js) across platforms.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@/shared/logger.js";
import type { DependencyName, InstallResult, InstallationMethod } from "@/types";
import { NODEJS_INSTALLERS, getNodejsInstructions } from "./dependencies/node-installer.js";
import { PYTHON_INSTALLERS, getPythonInstructions } from "./dependencies/python-installer.js";
import {
	CLAUDE_INSTALLERS,
	type OSInfo,
	detectOS,
	getClaudeInstructions,
} from "./dependencies/system-installer.js";
import { DEPENDENCIES, checkDependency } from "./dependency-checker.js";

const execAsync = promisify(exec);

// Re-exports
export type { OSInfo } from "./dependencies/system-installer.js";
export { detectOS } from "./dependencies/system-installer.js";
export { CLAUDE_INSTALLERS, PYTHON_INSTALLERS, NODEJS_INSTALLERS };

/**
 * Get installation methods for a dependency
 */
export function getInstallerMethods(
	dependency: DependencyName,
	osInfo: OSInfo,
): InstallationMethod[] {
	let installers =
		dependency === "claude"
			? CLAUDE_INSTALLERS
			: dependency === "python" || dependency === "pip"
				? PYTHON_INSTALLERS
				: dependency === "nodejs"
					? NODEJS_INSTALLERS
					: [];

	installers = installers.filter((m) => m.platform === osInfo.platform);

	// Filter by available package managers
	if (osInfo.platform === "darwin" && !osInfo.hasHomebrew) {
		installers = installers.filter((m) => !m.command.includes("brew"));
	} else if (osInfo.platform === "linux") {
		if (!osInfo.hasApt) installers = installers.filter((m) => !m.command.includes("apt"));
		if (!osInfo.hasDnf) installers = installers.filter((m) => !m.command.includes("dnf"));
		if (!osInfo.hasPacman) installers = installers.filter((m) => !m.command.includes("pacman"));
	}

	return installers.sort((a, b) => a.priority - b.priority);
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
		if (selectedMethod.requiresSudo) logger.info("⚠️  This installation requires sudo privileges");

		try {
			await execAsync(selectedMethod.command);
		} catch (error) {
			throw new Error(`Installation command failed: ${error}`);
		}

		const config = DEPENDENCIES[dependency === "pip" ? "python" : dependency];
		const status = await checkDependency(config);

		return status.installed
			? {
					success: true,
					message: `Successfully installed ${dependency}`,
					installedVersion: status.version,
				}
			: {
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
	if (dependency === "claude") return getClaudeInstructions(osInfo);
	if (dependency === "python" || dependency === "pip") return getPythonInstructions(osInfo);
	if (dependency === "nodejs") return getNodejsInstructions(osInfo);
	return [];
}
