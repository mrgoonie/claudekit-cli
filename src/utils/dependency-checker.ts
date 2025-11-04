import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { DependencyConfig, DependencyName, DependencyStatus } from "../types.js";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

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
	npm: {
		name: "npm",
		commands: ["npm"],
		versionFlag: "--version",
		versionRegex: /(\d+\.\d+\.\d+)/,
		minVersion: undefined, // Any version is fine
		required: true,
	},
};

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
	try {
		const whichCmd = process.platform === "win32" ? "where" : "which";
		await execAsync(`${whichCmd} ${command}`);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the path to a command
 */
export async function getCommandPath(command: string): Promise<string | null> {
	try {
		const whichCmd = process.platform === "win32" ? "where" : "which";
		const { stdout } = await execAsync(`${whichCmd} ${command}`);
		return stdout.trim().split("\n")[0] || null;
	} catch {
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
	try {
		const { stdout, stderr } = await execAsync(`${command} ${versionFlag}`);
		// Some commands output version to stderr (like python --version in older versions)
		const output = stdout || stderr;
		const match = output.match(versionRegex);
		return match?.[1] || null;
	} catch (error) {
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
	// Try each command variant (e.g., python3, python)
	for (const command of config.commands) {
		const exists = await commandExists(command);

		if (exists) {
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
	const checks = Object.values(DEPENDENCIES).map((config) => checkDependency(config));
	return Promise.all(checks);
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
