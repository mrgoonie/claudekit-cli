/**
 * Transform Validator
 *
 * Validates folder name options for CLI commands
 */

import { logger } from "@/shared/logger.js";

/**
 * Validate CLI folder options and exit on error
 * Use this in CLI commands to validate --docs-dir and --plans-dir flags
 */
export function validateFolderOptions(options: {
	docsDir?: string;
	plansDir?: string;
}): void {
	if (options.docsDir) {
		const docsError = validateFolderName(options.docsDir);
		if (docsError) {
			logger.error(`Invalid --docs-dir value: ${docsError}`);
			process.exit(1);
		}
	}
	if (options.plansDir) {
		const plansError = validateFolderName(options.plansDir);
		if (plansError) {
			logger.error(`Invalid --plans-dir value: ${plansError}`);
			process.exit(1);
		}
	}
}

/**
 * Validate custom folder name
 * Returns error message if invalid, null if valid
 */
export function validateFolderName(name: string): string | null {
	if (!name || name.trim().length === 0) {
		return "Folder name cannot be empty";
	}

	// Check for path traversal
	if (name.includes("..") || name.includes("/") || name.includes("\\")) {
		return "Folder name cannot contain path separators or parent references";
	}

	// Check for invalid characters (includes control chars 0x00-0x1f)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional check for invalid filename characters
	const invalidChars = /[<>:"|?*\x00-\x1f]/;
	if (invalidChars.test(name)) {
		return "Folder name contains invalid characters";
	}

	// Check for reserved names (Windows)
	const reservedNames = [
		"CON",
		"PRN",
		"AUX",
		"NUL",
		"COM1",
		"COM2",
		"COM3",
		"COM4",
		"COM5",
		"COM6",
		"COM7",
		"COM8",
		"COM9",
		"LPT1",
		"LPT2",
		"LPT3",
		"LPT4",
		"LPT5",
		"LPT6",
		"LPT7",
		"LPT8",
		"LPT9",
	];
	if (reservedNames.includes(name.toUpperCase())) {
		return "Folder name is a reserved system name";
	}

	// Check length
	if (name.length > 255) {
		return "Folder name is too long (max 255 characters)";
	}

	return null;
}
