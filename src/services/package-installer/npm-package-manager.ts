import { isCIEnvironment } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { execAsync, getNpmCommand } from "./process-executor.js";
import type { PackageInstallResult } from "./types.js";
import { validatePackageName } from "./validators.js";

/**
 * Check if a package is globally installed
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
	validatePackageName(packageName);

	// Skip network calls in CI environment - assume packages are not installed
	if (isCIEnvironment()) {
		logger.info(`CI environment detected: skipping network check for ${packageName}`);
		return false;
	}

	// Special handling for npm itself - use npm --version as basic check
	if (packageName === "npm") {
		try {
			await execAsync(`${getNpmCommand()} --version`, { timeout: 3000 });
			return true;
		} catch {
			return false;
		}
	}

	// For other packages, use faster and more reliable detection methods
	try {
		// Method 1: Quick check with npm view (fast for non-existent packages)
		// This command is much faster for packages that don't exist
		await execAsync(`${getNpmCommand()} view ${packageName} version`, { timeout: 3000 });

		// Package exists in npm registry, now check if it's installed globally
		try {
			// Method 2: Check if globally installed with shorter timeout
			const { stdout } = await execAsync(`${getNpmCommand()} list -g ${packageName} --depth=0`, {
				timeout: 3000,
			});

			// Check if package name appears in output (case-insensitive)
			const caseInsensitiveMatch = stdout.toLowerCase().includes(packageName.toLowerCase());
			if (caseInsensitiveMatch) {
				return true;
			}

			// Method 3: Try JSON format for more reliable parsing
			const { stdout: jsonOutput } = await execAsync(
				`${getNpmCommand()} list -g ${packageName} --depth=0 --json`,
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
	if (isCIEnvironment()) {
		logger.info(`CI environment detected: skipping version check for ${packageName}`);
		return null;
	}

	// Special handling for npm itself - use npm --version directly
	if (packageName === "npm") {
		try {
			const { stdout } = await execAsync(`${getNpmCommand()} --version`, { timeout: 3000 });
			return stdout.trim();
		} catch {
			return null;
		}
	}

	// First quickly check if package exists in npm registry
	try {
		await execAsync(`${getNpmCommand()} view ${packageName} version`, { timeout: 3000 });
	} catch {
		// Package doesn't exist exist in npm registry
		return null;
	}

	try {
		// Method 1: Try JSON format for reliable parsing with shorter timeout
		const { stdout: jsonOutput } = await execAsync(
			`${getNpmCommand()} list -g ${packageName} --depth=0 --json`,
			{
				timeout: 3000,
			},
		);

		const packageList = JSON.parse(jsonOutput);
		if (packageList.dependencies?.[packageName]) {
			return packageList.dependencies[packageName].version || null;
		}
	} catch {
		// JSON parsing failed, try text method as fallback
	}

	try {
		// Method 2: Fallback to text parsing with improved regex and shorter timeout
		const { stdout } = await execAsync(`${getNpmCommand()} list -g ${packageName} --depth=0`, {
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

		await execAsync(`${getNpmCommand()} install -g ${packageName}`, {
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
