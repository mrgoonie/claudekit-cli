/**
 * Prefix Utilities
 *
 * Utility functions for path validation and prefix operations
 */

import { logger } from "@/shared/logger.js";

/**
 * Options for cleanup operations
 */
export interface CleanupOptions {
	/** Dry-run mode: preview changes without applying */
	dryRun?: boolean;
	/** Force mode: override ownership protections */
	forceOverwrite?: boolean;
}

/**
 * Remove Windows drive prefixes (e.g., C:\, \\?\C:\) so that colon characters
 * used in drive letters don't trigger invalid character validation.
 */
export function stripWindowsDrivePrefix(path: string): string {
	if (path.length >= 2 && /[a-zA-Z]/.test(path[0]) && path[1] === ":") {
		return path.slice(2);
	}

	if (path.startsWith("\\\\?\\")) {
		const remainder = path.slice(4);
		if (remainder.length >= 2 && /[a-zA-Z]/.test(remainder[0]) && remainder[1] === ":") {
			return remainder.slice(2);
		}
	}

	return path;
}

/**
 * Validate path to prevent security vulnerabilities
 * @param path Path to validate
 * @param paramName Parameter name for error messages
 * @throws {Error} If path is invalid or contains security risks
 */
export function validatePath(path: string, paramName: string): void {
	if (!path || typeof path !== "string") {
		throw new Error(`${paramName} must be a non-empty string`);
	}
	if (path.length > 1000) {
		throw new Error(`${paramName} path too long (max 1000 chars)`);
	}
	// Block path traversal: ".." as complete path component (not inside filenames like "file..txt")
	// Also block "~" at start (Unix home expansion, but allow middle for Windows 8.3 short names)
	// Regex matches ".." only when preceded/followed by path separator or string boundary
	if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path) || path.startsWith("~")) {
		throw new Error(`${paramName} contains path traversal: ${path}`);
	}

	const sanitizedPath = stripWindowsDrivePrefix(path);
	if (/[<>:"|?*]/.test(sanitizedPath)) {
		logger.debug(`Path validation failed (invalid character) for ${paramName}: ${path}`);
		throw new Error(`${paramName} contains invalid characters: ${path}`);
	}
	// Check for control characters
	for (let i = 0; i < path.length; i++) {
		const code = path.charCodeAt(i);
		if (code < 32 || code === 127) {
			throw new Error(`${paramName} contains control characters`);
		}
	}
}

/**
 * Check if prefix should be applied based on options
 * @param options Command options object
 * @returns true if --prefix flag is set
 */
export function shouldApplyPrefix(options: { prefix?: boolean }): boolean {
	return options.prefix === true;
}
