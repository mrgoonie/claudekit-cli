/**
 * Standard error message formats for consistency across the codebase
 */

/**
 * Format error for failed operations
 * @example operationError("Checksum calculation", "file.txt", "ENOENT")
 *          → "Checksum calculation failed for 'file.txt': ENOENT"
 */
export function operationError(operation: string, subject: string, details: string): string {
	return `${operation} failed for '${subject}': ${details}`;
}

/**
 * Format error for not found items
 * @example notFoundError("Command", "python", "check PATH")
 *          → "Command not found: python (check PATH)"
 */
export function notFoundError(type: string, name: string, hint?: string): string {
	return hint ? `${type} not found: ${name} (${hint})` : `${type} not found: ${name}`;
}

/**
 * Format error for validation issues
 * @example validationError("path", "must be absolute")
 *          → "Invalid path: must be absolute"
 */
export function validationError(field: string, issue: string): string {
	return `Invalid ${field}: ${issue}`;
}

/**
 * Format error for security violations
 * @example securityError("path traversal", "../etc/passwd")
 *          → "Security violation (path traversal): '../etc/passwd'"
 */
export function securityError(type: string, details: string): string {
	return `Security violation (${type}): '${details}'`;
}
