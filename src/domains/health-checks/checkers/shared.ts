import { shouldSkipExpensiveOperations as shouldSkipExpensiveChecks } from "@/shared/environment.js";

/**
 * Check if we should skip expensive operations (CI without isolated test paths)
 * IMPORTANT: This must be a function, not a constant, because env vars
 * may be set AFTER module load (e.g., in tests)
 *
 * Skip when: CI environment WITHOUT isolated test paths (CK_TEST_HOME)
 * Don't skip when: Unit tests with CK_TEST_HOME set (isolated environment)
 */
export function shouldSkipExpensiveOperations(): boolean {
	return shouldSkipExpensiveChecks();
}

// Hook file extensions that are recognized
export const HOOK_EXTENSIONS = [".js", ".cjs", ".mjs", ".ts", ".sh", ".ps1"];
