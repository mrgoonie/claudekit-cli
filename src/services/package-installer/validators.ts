import { resolve } from "node:path";
import { logger } from "@/shared/logger.js";

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

/**
 * Validate script path is safe before execution
 * Prevents path traversal and shell injection attacks
 */
export function validateScriptPath(skillsDir: string, scriptPath: string): void {
	const skillsDirResolved = resolve(skillsDir);
	const scriptPathResolved = resolve(scriptPath);

	// Must be within skills directory (case-insensitive on Windows)
	const isWindows = process.platform === "win32";
	const skillsDirNormalized = isWindows ? skillsDirResolved.toLowerCase() : skillsDirResolved;
	const scriptPathNormalized = isWindows ? scriptPathResolved.toLowerCase() : scriptPathResolved;

	if (!scriptPathNormalized.startsWith(skillsDirNormalized)) {
		throw new Error(`Script path outside skills directory: ${scriptPath}`);
	}

	// No shell-breaking characters that could enable injection
	const dangerousChars = ['"', "'", "`", "$", ";", "&", "|", "\n", "\r", "\0"];
	for (const char of dangerousChars) {
		if (scriptPath.includes(char)) {
			throw new Error(`Script path contains unsafe character: ${char}`);
		}
	}

	logger.debug(`Script path validated: ${scriptPath}`);
}
