import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

// Check if we're in CI environment to skip network calls
const isCIEnvironment = process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";

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
		throw new Error("Package name too long");
	}

	if (!NPM_PACKAGE_REGEX.test(packageName)) {
		throw new Error("Invalid package name");
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

	// Skip network calls in CI environment - assume packages are not installed
	if (isCIEnvironment) {
		logger.info(`CI environment detected: skipping network check for ${packageName}`);
		return false;
	}

	// Special handling for npm itself - use npm --version as basic check
	if (packageName === "npm") {
		try {
			await execAsync("npm --version", { timeout: 3000 });
			return true;
		} catch {
			return false;
		}
	}

	// For other packages, use faster and more reliable detection methods
	try {
		// Method 1: Quick check with npm view (fast for non-existent packages)
		// This command is much faster for packages that don't exist
		await execAsync(`npm view ${packageName} version`, { timeout: 3000 });

		// Package exists in npm registry, now check if it's installed globally
		try {
			// Method 2: Check if globally installed with shorter timeout
			const { stdout } = await execAsync(`npm list -g ${packageName} --depth=0`, {
				timeout: 3000,
			});

			// Check if package name appears in output (case-insensitive)
			const caseInsensitiveMatch = stdout.toLowerCase().includes(packageName.toLowerCase());
			if (caseInsensitiveMatch) {
				return true;
			}

			// Method 3: Try JSON format for more reliable parsing
			const { stdout: jsonOutput } = await execAsync(
				`npm list -g ${packageName} --depth=0 --json`,
				{
					timeout: 3000,
				},
			);

			// Parse JSON to check if package exists
			const packageList = JSON.parse(jsonOutput);
			return packageList.dependencies?.[packageName] || false;
		} catch {
			// Package exists in registry but not installed globally
			return false;
		}
	} catch {
		// npm view failed, package doesn't exist in registry
		return false;
	}
}

/**
 * Get package version if installed
 */
export async function getPackageVersion(packageName: string): Promise<string | null> {
	validatePackageName(packageName);

	// Skip network calls in CI environment
	if (isCIEnvironment) {
		logger.info(`CI environment detected: skipping version check for ${packageName}`);
		return null;
	}

	// Special handling for npm itself - use npm --version directly
	if (packageName === "npm") {
		try {
			const { stdout } = await execAsync("npm --version", { timeout: 3000 });
			return stdout.trim();
		} catch {
			return null;
		}
	}

	// First quickly check if package exists in npm registry
	try {
		await execAsync(`npm view ${packageName} version`, { timeout: 3000 });
	} catch {
		// Package doesn't exist in npm registry
		return null;
	}

	try {
		// Method 1: Try JSON format for reliable parsing with shorter timeout
		const { stdout: jsonOutput } = await execAsync(`npm list -g ${packageName} --depth=0 --json`, {
			timeout: 3000,
		});

		const packageList = JSON.parse(jsonOutput);
		if (packageList.dependencies?.[packageName]) {
			return packageList.dependencies[packageName].version || null;
		}
	} catch {
		// JSON parsing failed, try text method as fallback
	}

	try {
		// Method 2: Fallback to text parsing with improved regex and shorter timeout
		const { stdout } = await execAsync(`npm list -g ${packageName} --depth=0`, {
			timeout: 3000,
		});

		// Multiple regex patterns to handle different output formats
		const patterns = [
			// Standard format: packageName@version
			new RegExp(`${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@([^\\s\\n]+)`),
			// Format with empty: └── packageName@1.0.0
			new RegExp(
				`${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@([0-9]+\\.[0-9]+\\.[0-9]+(?:-[\\w.-]+)?)`,
			),
		];

		for (const pattern of patterns) {
			const match = stdout.match(pattern);
			if (match?.[1]) {
				return match[1].trim();
			}
		}

		return null;
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

		await execAsync(`npm install -g ${packageName}`, {
			timeout: 120000, // 2 minute timeout for npm install
		});

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

	// Skip network calls in CI environment
	if (isCIEnvironment) {
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
		const { exec } = await import("node:child_process");
		const { promisify } = await import("node:util");
		const { unlink } = await import("node:fs/promises");
		const { join } = await import("node:path");
		const { tmpdir } = await import("node:os");

		const execAsyncLocal = promisify(exec);
		const tempScriptPath = join(tmpdir(), "opencode-install.sh");

		try {
			// Download the script first
			logger.info("Downloading OpenCode installation script...");
			await execAsyncLocal(`curl -fsSL https://opencode.ai/install -o ${tempScriptPath}`, {
				timeout: 30000, // 30 second timeout for download
			});

			// Make the script executable
			await execAsyncLocal(`chmod +x ${tempScriptPath}`, {
				timeout: 5000, // 5 second timeout for chmod
			});

			// Execute the downloaded script
			logger.info("Executing OpenCode installation script...");
			await execAsyncLocal(`bash ${tempScriptPath}`, {
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
