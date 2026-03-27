/**
 * Result of a package installation operation
 */
export interface PackageInstallResult {
	success: boolean;
	package: string;
	version?: string;
	error?: string;
	/** True when installation was intentionally skipped (e.g., test environment) */
	skipped?: boolean;
}

/** Version marker for partial/interrupted installations */
export const PARTIAL_INSTALL_VERSION = "partial";

/** Exit codes for skills installation (from install.sh) */
export const EXIT_CODE_CRITICAL_FAILURE = 1;
export const EXIT_CODE_PARTIAL_SUCCESS = 2;
