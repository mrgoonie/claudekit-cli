import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

// NPM package name validation regex (from npm spec)
const NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Validate npm package name to prevent command injection
 */
export function validatePackageName(packageName: string): void {
	if (!packageName || typeof packageName !== "string") {
		throw new Error("Package name must be a non-empty string");
	}

	if (packageName.length > 214) {
		throw new Error("Package name too long (max 214 characters)");
	}

	if (!NPM_PACKAGE_REGEX.test(packageName)) {
		throw new Error(`Invalid package name: ${packageName}`);
	}
}

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
	validatePackageName(packageName);

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
	validatePackageName(packageName);

	try {
		const { stdout } = await execAsync(`npm list -g ${packageName} --depth=0`);
		// Escape package name for regex to prevent ReDoS attacks
		const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const match = stdout.match(new RegExp(`${escapedPackageName}@([^\\s\\n]+)`));
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

	// Validate package name to prevent command injection
	validatePackageName(packageName);

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
 * Install OpenCode CLI package using install script
 */
export async function installOpenCode(): Promise<PackageInstallResult> {
	const displayName = "OpenCode CLI";

	try {
		logger.info(`Installing ${displayName}...`);

		// Use the official install script
		await execAsync(
			"curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/refs/heads/main/install | bash",
		);

		// Check if installation was successful by trying to run opencode
		try {
			await execAsync("opencode --version");
			logger.success(`${displayName} installed successfully`);

			return {
				success: true,
				package: displayName,
			};
		} catch {
			return {
				success: false,
				package: displayName,
				error: "Installation completed but opencode command not found in PATH",
			};
		}
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
 * Install Google Gemini CLI package
 */
export async function installGemini(): Promise<PackageInstallResult> {
	return installPackageGlobally("@google/gemini-cli", "Google Gemini CLI");
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
		// Check if opencode is available in PATH
		try {
			await execAsync("opencode --version");
			logger.info("OpenCode CLI already installed");
			results.opencode = {
				success: true,
				package: "OpenCode CLI",
			};
		} catch {
			results.opencode = await installOpenCode();
		}
	}

	if (shouldInstallGemini) {
		const alreadyInstalled = await isPackageInstalled("@google/gemini-cli");
		if (alreadyInstalled) {
			const version = await getPackageVersion("@google/gemini-cli");
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
