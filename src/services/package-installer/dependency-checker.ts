import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@/shared/logger.js";
import type { DependencyConfig, DependencyName, DependencyStatus } from "@/types";

const execAsync = promisify(exec);

/**
 * Check if we should skip expensive operations (CI without isolated test paths)
 * IMPORTANT: This must be a function, not a constant, because env vars
 * may be set AFTER module load (e.g., in tests)
 *
 * Skip when: CI environment WITHOUT isolated test paths (CK_TEST_HOME)
 * Don't skip when: Unit tests with CK_TEST_HOME set (isolated environment)
 */
function shouldSkipExpensiveOperations(): boolean {
	// If CK_TEST_HOME is set, we're in an isolated test environment - run the actual tests
	if (process.env.CK_TEST_HOME) {
		return false;
	}
	// Skip in CI or when CI_SAFE_MODE is set (no isolated paths)
	return process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";
}

/**
 * Get detailed OS information for end-user detection
 */
export function getOSInfo(): {
	platform: NodeJS.Platform;
	arch: string;
	isWindows: boolean;
	isMacOS: boolean;
	isLinux: boolean;
	isWSL: boolean;
	details: string;
} {
	const platform = process.platform;
	const arch = process.arch;
	const isWindows = platform === "win32";
	const isMacOS = platform === "darwin";
	const isLinux = platform === "linux";

	// Check for WSL (Windows Subsystem for Linux)
	const isWSL = isLinux && process.env.WSL_DISTRO_NAME !== undefined;

	let details = `${platform}-${arch}`;
	if (isWSL) {
		details += ` (WSL: ${process.env.WSL_DISTRO_NAME})`;
	}

	return {
		platform,
		arch,
		isWindows,
		isMacOS,
		isLinux,
		isWSL,
		details,
	};
}

/**
 * Get platform-specific command paths for CI environment
 */
function getCICommandPath(command: string): string | null {
	const osInfo = getOSInfo();

	// Return platform-specific mock paths for CI
	switch (command) {
		case "node":
			return osInfo.isWindows ? "C:\\Program Files\\nodejs\\node.exe" : "/usr/bin/node";
		case "python3":
		case "python":
			return osInfo.isWindows ? "C:\\Python39\\python.exe" : "/usr/bin/python3";
		case "pip3":
		case "pip":
			return osInfo.isWindows ? "C:\\Python39\\Scripts\\pip.exe" : "/usr/bin/pip3";
		default:
			return null;
	}
}

/**
 * Dependency configurations for Claude CLI, Python, and Node.js
 */
export const DEPENDENCIES: Record<DependencyName, DependencyConfig> = {
	claude: {
		name: "claude",
		commands: ["claude"],
		versionFlag: "--version",
		versionRegex: /(\d+\.\d+\.\d+)/,
		minVersion: "1.0.0",
		required: false, // Nice to have
	},
	python: {
		name: "python",
		commands: ["python3", "python"],
		versionFlag: "--version",
		versionRegex: /Python (\d+\.\d+\.\d+)/,
		minVersion: "3.8.0",
		required: true, // Required for ClaudeKit skills
	},
	pip: {
		name: "pip",
		commands: ["pip3", "pip"],
		versionFlag: "--version",
		versionRegex: /pip (\d+\.\d+\.\d+)/,
		minVersion: undefined, // Any version is fine
		required: true,
	},
	nodejs: {
		name: "nodejs",
		commands: ["node"],
		versionFlag: "--version",
		versionRegex: /v?(\d+\.\d+\.\d+)/,
		minVersion: "16.0.0",
		required: true, // Required for ClaudeKit skills
	},
};

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
	// In CI/test environment, assume basic commands are available for common tools
	if (shouldSkipExpensiveOperations()) {
		const supportedCommands = ["node", "python", "python3", "pip", "pip3", "claude"];
		return supportedCommands.includes(command);
	}

	try {
		const whichCmd = process.platform === "win32" ? "where" : "which";
		logger.verbose(`Checking if command exists: ${command}`);
		await execAsync(`${whichCmd} ${command}`);
		logger.verbose(`Command found: ${command}`);
		return true;
	} catch {
		logger.verbose(`Command not found: ${command}`);
		return false;
	}
}

/**
 * Get the path to a command
 */
export async function getCommandPath(command: string): Promise<string | null> {
	// In CI/test environment, return platform-specific mock paths for basic commands
	if (shouldSkipExpensiveOperations()) {
		const ciPath = getCICommandPath(command);
		if (ciPath) return ciPath;
	}

	try {
		const whichCmd = process.platform === "win32" ? "where" : "which";
		logger.verbose(`Getting path for command: ${command}`);
		const { stdout } = await execAsync(`${whichCmd} ${command}`);
		const path = stdout.trim().split("\n")[0] || null;
		logger.verbose(`Command path resolved: ${command} -> ${path}`);
		return path;
	} catch {
		logger.verbose(`Failed to get path for command: ${command}`);
		return null;
	}
}

/**
 * Get command version
 */
export async function getCommandVersion(
	command: string,
	versionFlag: string,
	versionRegex: RegExp,
): Promise<string | null> {
	// In CI/test environment, return mock versions for common commands
	if (shouldSkipExpensiveOperations()) {
		const mockVersions: Record<string, string> = {
			npm: "10.0.0",
			node: "20.0.0",
			python: "3.11.0",
			python3: "3.11.0",
			pip: "23.0.0",
			pip3: "23.0.0",
			claude: "1.0.0",
		};
		return mockVersions[command] || null;
	}

	try {
		logger.verbose(`Getting version for: ${command} ${versionFlag}`);
		const { stdout, stderr } = await execAsync(`${command} ${versionFlag}`);
		// Some commands output version to stderr (like python --version in older versions)
		const output = stdout || stderr;
		const match = output.match(versionRegex);
		const version = match?.[1] || null;
		logger.verbose(`Version detected: ${command} -> ${version}`);
		return version;
	} catch (error) {
		logger.verbose(`Failed to get version for ${command}: ${error}`);
		logger.debug(`Failed to get version for ${command}: ${error}`);
		return null;
	}
}

/**
 * Compare semantic versions (major.minor.patch)
 * Returns true if current >= required
 */
export function compareVersions(current: string, required: string): boolean {
	const parseCurrent = current.split(".").map((n) => Number.parseInt(n, 10));
	const parseRequired = required.split(".").map((n) => Number.parseInt(n, 10));

	for (let i = 0; i < 3; i++) {
		const curr = parseCurrent[i] || 0;
		const req = parseRequired[i] || 0;

		if (curr > req) return true;
		if (curr < req) return false;
	}

	return true; // Equal versions
}

/**
 * Check a single dependency
 */
export async function checkDependency(config: DependencyConfig): Promise<DependencyStatus> {
	logger.verbose(`Checking dependency: ${config.name}`);
	// Try each command variant (e.g., python3, python)
	for (const command of config.commands) {
		const exists = await commandExists(command);

		if (exists) {
			logger.verbose(`Found ${config.name} via command: ${command}`);
			const path = await getCommandPath(command);
			const version = await getCommandVersion(command, config.versionFlag, config.versionRegex);

			// Check version requirements
			let meetsRequirements = true;
			let message: string | undefined;

			if (config.minVersion && version) {
				meetsRequirements = compareVersions(version, config.minVersion);
				if (!meetsRequirements) {
					message = `Version ${version} is below minimum ${config.minVersion}`;
				}
			}

			return {
				name: config.name,
				installed: true,
				version: version || undefined,
				path: path || undefined,
				minVersion: config.minVersion,
				meetsRequirements,
				message,
			};
		}
	}

	// Not found
	return {
		name: config.name,
		installed: false,
		meetsRequirements: false,
		minVersion: config.minVersion,
		message: `${config.name} not found in PATH`,
	};
}

/**
 * Check all dependencies in parallel
 */
export async function checkAllDependencies(): Promise<DependencyStatus[]> {
	logger.verbose("Checking all dependencies in parallel");
	const checks = Object.values(DEPENDENCIES).map((config) => checkDependency(config));
	const results = await Promise.all(checks);
	logger.verbose("All dependency checks complete", {
		count: results.length,
	});
	return results;
}

/**
 * Check specific dependencies
 */
export async function checkSpecificDependencies(
	names: DependencyName[],
): Promise<DependencyStatus[]> {
	const checks = names.map((name) => checkDependency(DEPENDENCIES[name]));
	return Promise.all(checks);
}
