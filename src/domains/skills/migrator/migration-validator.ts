import { SkillsMigrationError } from "@/types";

/**
 * Validate path input to prevent security issues
 */
export function validateMigrationPath(path: string, paramName: string): void {
	if (!path || typeof path !== "string") {
		throw new SkillsMigrationError(`${paramName} must be a non-empty string`);
	}

	// Check for path length limits to prevent DoS
	if (path.length > 1000) {
		throw new SkillsMigrationError(`${paramName} path too long (max 1000 characters)`);
	}

	// Check for path traversal attempts
	// Note: Windows uses ~ in short path format (e.g., C:\Users\RUNNER~1\...), which is safe
	// Only reject ~ in non-Windows absolute paths (Unix home directory expansion)
	const isWindowsAbsolutePath = /^[A-Za-z]:[/\\]/.test(path);
	const hasDangerousTilde = path.includes("~") && !isWindowsAbsolutePath;

	// Match ".." only as complete path component (allows filenames like "file..txt")
	// Regex matches ".." when preceded/followed by path separator or string boundary
	if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path) || hasDangerousTilde) {
		throw new SkillsMigrationError(
			`${paramName} contains potentially dangerous path traversal: ${path}`,
		);
	}

	// Check for dangerous characters that could cause filesystem issues
	// Note: Windows paths like "C:\..." have a colon after the drive letter, which is valid
	// Remove Windows drive letter (if present) before checking for dangerous characters
	const pathWithoutDrive = path.replace(/^[A-Za-z]:/, "");
	if (/[<>:"|?*]/.test(pathWithoutDrive)) {
		throw new SkillsMigrationError(`${paramName} contains invalid characters: ${path}`);
	}

	// Additional check for control characters
	for (let i = 0; i < path.length; i++) {
		const charCode = path.charCodeAt(i);
		if (charCode < 32 || charCode === 127) {
			throw new SkillsMigrationError(`${paramName} contains control characters: ${path}`);
		}
	}
}
