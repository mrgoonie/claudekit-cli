/**
 * Check if we should skip expensive operations (CI without isolated test paths)
 * IMPORTANT: This must be a function, not a constant, because env vars
 * may be set AFTER module load (e.g., in tests)
 *
 * Skip when: CI environment WITHOUT isolated test paths (CK_TEST_HOME)
 * Don't skip when: Unit tests with CK_TEST_HOME set (isolated environment)
 */
export function shouldSkipExpensiveOperations(): boolean {
	// If CK_TEST_HOME is set, we're in an isolated test environment - run the actual tests
	if (process.env.CK_TEST_HOME) {
		return false;
	}
	// Skip in CI or when CI_SAFE_MODE is set (no isolated paths)
	return process.env.CI === "true" || process.env.CI_SAFE_MODE === "true";
}

// Hook file extensions that are recognized
export const HOOK_EXTENSIONS = [".js", ".cjs", ".mjs", ".ts", ".sh", ".ps1"];
