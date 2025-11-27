import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TestPaths {
	testHome: string;
	cacheDir: string;
	configDir: string;
	claudeDir: string;
	cleanup: () => void;
}

/**
 * Setup isolated test paths with unique temp directory
 * Sets CK_TEST_HOME environment variable for PathResolver
 *
 * @returns TestPaths object with cleanup function
 */
export function setupTestPaths(): TestPaths {
	const timestamp = Date.now();
	const random = Math.floor(Math.random() * 10000);
	const testHome = join(tmpdir(), `ck-test-${timestamp}-${random}`);

	// Create base directories for both local and global modes
	mkdirSync(testHome, { recursive: true });
	// Local mode paths
	mkdirSync(join(testHome, ".claudekit"), { recursive: true });
	mkdirSync(join(testHome, ".claudekit", "cache"), { recursive: true });
	mkdirSync(join(testHome, ".claudekit", "cache", "releases"), {
		recursive: true,
	});
	// Global mode paths (simulated)
	mkdirSync(join(testHome, ".config", "claude"), { recursive: true });
	mkdirSync(join(testHome, ".cache", "claude"), { recursive: true });
	mkdirSync(join(testHome, ".claude"), { recursive: true });

	// Set test environment variable
	process.env.CK_TEST_HOME = testHome;

	const cleanup = () => {
		try {
			rmSync(testHome, { recursive: true, force: true });
		} catch (_error) {
			// Ignore cleanup errors
		}
		process.env.CK_TEST_HOME = undefined;
	};

	return {
		testHome,
		cacheDir: join(testHome, ".claudekit", "cache"),
		configDir: join(testHome, ".claudekit"),
		claudeDir: join(testHome, ".claude"),
		cleanup,
	};
}

/**
 * Get current test home directory
 * Returns undefined if not in test mode
 */
export function getTestHome(): string | undefined {
	return process.env.CK_TEST_HOME;
}

/**
 * Check if currently in test mode
 */
export function isTestMode(): boolean {
	return process.env.CK_TEST_HOME !== undefined;
}
