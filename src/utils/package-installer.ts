import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

export interface PackageInstallResult {
	success: boolean;
	package: string;
	version?: string;
	error?: string;
}

/**
 * Check if a package is globally installed
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
	try {
		const { stdout } = await execAsync(`npm list -g ${packageName}`);
		return stdout.includes(packageName);
	} catch {
		return false;
	}
}

/**
 * Get package version if installed
 */
export async function getPackageVersion(packageName: string): Promise<string | null> {
	try {
		const { stdout } = await execAsync(`npm list -g ${packageName} --depth=0`);
		const match = stdout.match(new RegExp(`${packageName}@(.+)`));
		return match ? match[1].trim() : null;
	} catch {
		return null;
	}
}

/**
 * Install a package globally using npm
 */
export async function installPackageGlobally(
	packageName: string,
	packageDisplayName?: string,
): Promise<PackageInstallResult> {
	const displayName = packageDisplayName || packageName;

	try {
		logger.info(`Installing ${displayName} globally...`);

		await execAsync(`npm install -g ${packageName}`);

		// Check if installation was successful
		const isInstalled = await isPackageInstalled(packageName);
		if (!isInstalled) {
			return {
				success: false,
				package: displayName,
				error: "Installation completed but package not found",
			};
		}

		const version = await getPackageVersion(packageName);

		logger.success(`${displayName} ${version ? `v${version} ` : ""}installed successfully`);

		return {
			success: true,
			package: displayName,
			version: version || undefined,
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

/**
 * Install OpenCode CLI package
 */
export async function installOpenCode(): Promise<PackageInstallResult> {
	return installPackageGlobally("@opencode/cli", "OpenCode CLI");
}

/**
 * Install Google Gemini CLI package
 */
export async function installGemini(): Promise<PackageInstallResult> {
	return installPackageGlobally("@google-ai/generative-ai-cli", "Google Gemini CLI");
}

/**
 * Check and install packages based on user preferences
 */
export async function processPackageInstallations(
	shouldInstallOpenCode: boolean,
	shouldInstallGemini: boolean,
): Promise<{
	opencode?: PackageInstallResult;
	gemini?: PackageInstallResult;
}> {
	const results: {
		opencode?: PackageInstallResult;
		gemini?: PackageInstallResult;
	} = {};

	if (shouldInstallOpenCode) {
		const alreadyInstalled = await isPackageInstalled("@opencode/cli");
		if (alreadyInstalled) {
			const version = await getPackageVersion("@opencode/cli");
			logger.info(`OpenCode CLI already installed ${version ? `(v${version})` : ""}`);
			results.opencode = {
				success: true,
				package: "OpenCode CLI",
				version: version || undefined,
			};
		} else {
			results.opencode = await installOpenCode();
		}
	}

	if (shouldInstallGemini) {
		const alreadyInstalled = await isPackageInstalled("@google-ai/generative-ai-cli");
		if (alreadyInstalled) {
			const version = await getPackageVersion("@google-ai/generative-ai-cli");
			logger.info(`Google Gemini CLI already installed ${version ? `(v${version})` : ""}`);
			results.gemini = {
				success: true,
				package: "Google Gemini CLI",
				version: version || undefined,
			};
		} else {
			results.gemini = await installGemini();
		}
	}

	return results;
}
