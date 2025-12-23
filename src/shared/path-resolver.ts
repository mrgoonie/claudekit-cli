import { homedir, platform } from "node:os";
import { join, normalize } from "node:path";

/**
 * Safely retrieve environment variable with validation
 * @param name - Environment variable name
 * @returns Environment variable value if safe, undefined otherwise
 * @internal
 */
function getEnvVar(name: string): string | undefined {
	const val = process.env[name];
	if (!val || val.trim() === "") return undefined;

	// Validate no path traversal in env var
	if (val.includes("..")) {
		console.warn(`Environment variable ${name} contains path traversal: ${val}`);
		return undefined;
	}

	return val;
}

/**
 * Platform-aware path resolver for ClaudeKit configuration directories
 * Follows XDG Base Directory specification for Linux/macOS
 * Uses %LOCALAPPDATA% for Windows
 */
export class PathResolver {
	/**
	 * Get test home directory if running in test mode
	 * Returns undefined in production
	 *
	 * @internal Used by tests to inject isolated directories
	 */
	private static getTestHomeDir(): string | undefined {
		return process.env.CK_TEST_HOME;
	}

	/**
	 * Validate a path component to prevent path traversal attacks
	 *
	 * @param path - Path or component to validate
	 * @returns true if the path is safe, false if it contains traversal patterns
	 *
	 * @example
	 * ```typescript
	 * PathResolver.isPathSafe("skills"); // true
	 * PathResolver.isPathSafe("../etc/passwd"); // false
	 * PathResolver.isPathSafe("folder\\..\\secret"); // false
	 * ```
	 */
	static isPathSafe(path: string): boolean {
		if (!path || typeof path !== "string") {
			return false;
		}

		// Normalize path to handle different separators
		const normalized = normalize(path);

		// Check for path traversal
		if (path.includes("..") || normalized.includes("..")) {
			return false;
		}

		// Check for home directory expansion (could be dangerous in some contexts)
		if (path.includes("~") || normalized.includes("~")) {
			return false;
		}

		// Check for absolute paths (Unix, Windows drive letter, Windows UNC)
		const isAbsolute =
			path.startsWith("/") ||
			normalized.startsWith("/") ||
			/^[a-zA-Z]:/.test(path) ||
			path.startsWith("\\\\") || // UNC path (\\server\share)
			normalized.startsWith("\\\\");

		if (isAbsolute) {
			return false;
		}

		return true;
	}
	/**
	 * Get the configuration directory path based on global flag
	 *
	 * @param global - Whether to use global configuration directory
	 * @returns Configuration directory path
	 *
	 * Local mode (default):
	 * - All platforms: ~/.claudekit
	 *
	 * Global mode:
	 * - macOS/Linux: ~/.config/claude (XDG-compliant)
	 * - Windows: %LOCALAPPDATA%\claude
	 */
	static getConfigDir(global = false): string {
		// Test mode override - use isolated directory
		const testHome = PathResolver.getTestHomeDir();
		if (testHome) {
			// In test mode, simulate real behavior with separate paths
			return global
				? join(testHome, ".config", "claude") // Global path simulation
				: join(testHome, ".claudekit"); // Local path
		}

		if (!global) {
			// Local mode: backward compatible ~/.claudekit
			return join(homedir(), ".claudekit");
		}

		// Global mode: platform-specific
		const os = platform();

		if (os === "win32") {
			// Windows: Use %LOCALAPPDATA% with fallback
			const localAppData = getEnvVar("LOCALAPPDATA") ?? join(homedir(), "AppData", "Local");
			return join(localAppData, "claude");
		}

		// macOS/Linux: Use XDG-compliant ~/.config
		const xdgConfigHome = getEnvVar("XDG_CONFIG_HOME");
		if (xdgConfigHome) {
			return join(xdgConfigHome, "claude");
		}

		return join(homedir(), ".config", "claude");
	}

	/**
	 * Get the config file path based on global flag
	 *
	 * @param global - Whether to use global configuration directory
	 * @returns Config file path
	 */
	static getConfigFile(global = false): string {
		return join(PathResolver.getConfigDir(global), "config.json");
	}

	/**
	 * Get the cache directory path based on global flag
	 *
	 * @param global - Whether to use global cache directory
	 * @returns Cache directory path
	 *
	 * Local mode (default):
	 * - All platforms: ~/.claudekit/cache
	 *
	 * Global mode:
	 * - macOS/Linux: ~/.cache/claude (XDG-compliant)
	 * - Windows: %LOCALAPPDATA%\claude\cache
	 */
	static getCacheDir(global = false): string {
		// Test mode override - use isolated directory
		const testHome = PathResolver.getTestHomeDir();
		if (testHome) {
			// In test mode, simulate real behavior with separate paths
			return global
				? join(testHome, ".cache", "claude") // Global cache simulation
				: join(testHome, ".claudekit", "cache"); // Local cache
		}

		if (!global) {
			// Local mode: backward compatible ~/.claudekit/cache
			return join(homedir(), ".claudekit", "cache");
		}

		// Global mode: platform-specific
		const os = platform();

		if (os === "win32") {
			// Windows: Use %LOCALAPPDATA%\claude\cache with fallback
			const localAppData = getEnvVar("LOCALAPPDATA") ?? join(homedir(), "AppData", "Local");
			return join(localAppData, "claude", "cache");
		}

		// macOS/Linux: Use XDG-compliant ~/.cache
		const xdgCacheHome = getEnvVar("XDG_CACHE_HOME");
		if (xdgCacheHome) {
			return join(xdgCacheHome, "claude");
		}

		return join(homedir(), ".cache", "claude");
	}

	/**
	 * Get the global kit installation directory
	 * This is separate from the config directory and is where .claude files are installed globally
	 *
	 * @returns Global kit installation directory path
	 *
	 * All platforms use: ~/.claude/
	 * - macOS: ~/.claude/
	 * - Windows: %USERPROFILE%\.claude\ (e.g., C:\Users\[USERNAME]\.claude)
	 * - Linux: ~/.claude/
	 */
	static getGlobalKitDir(): string {
		// Test mode override - use isolated directory
		const testHome = PathResolver.getTestHomeDir();
		if (testHome) {
			return join(testHome, ".claude");
		}

		// All platforms: ~/.claude/
		return join(homedir(), ".claude");
	}

	/**
	 * Get the ClaudeKit CLI data directory
	 * Used for CLI operational data: config, projects registry
	 *
	 * @returns ClaudeKit data directory path
	 * All platforms: ~/.claudekit/
	 */
	static getClaudeKitDir(): string {
		const testHome = PathResolver.getTestHomeDir();
		if (testHome) {
			return join(testHome, ".claudekit");
		}
		return join(homedir(), ".claudekit");
	}

	/**
	 * Get the ClaudeKit CLI config file path
	 *
	 * @returns Config file path (~/.claudekit/config.json)
	 */
	static getClaudeKitConfigPath(): string {
		return join(PathResolver.getClaudeKitDir(), "config.json");
	}

	/**
	 * Get the projects registry file path
	 *
	 * @returns Projects registry path (~/.claudekit/projects.json)
	 */
	static getProjectsRegistryPath(): string {
		return join(PathResolver.getClaudeKitDir(), "projects.json");
	}

	/**
	 * Get the directory prefix based on installation mode
	 *
	 * @param global - Whether to use global installation mode
	 * @returns Directory prefix (".claude" for local mode, "" for global mode)
	 *
	 * @example
	 * ```typescript
	 * // Local mode
	 * const prefix = PathResolver.getPathPrefix(false); // ".claude"
	 * // Global mode
	 * const prefix = PathResolver.getPathPrefix(true); // ""
	 * ```
	 */
	static getPathPrefix(global: boolean): string {
		return global ? "" : ".claude";
	}

	/**
	 * Build skills directory path based on installation mode
	 *
	 * @param baseDir - Base directory path
	 * @param global - Whether to use global installation mode
	 * @returns Skills directory path
	 *
	 * @example
	 * ```typescript
	 * // Local mode
	 * const path = PathResolver.buildSkillsPath("/project", false); // "/project/.claude/skills"
	 * // Global mode
	 * const path = PathResolver.buildSkillsPath(PathResolver.getGlobalKitDir(), true); // "~/.claude/skills"
	 * ```
	 */
	static buildSkillsPath(baseDir: string, global: boolean): string {
		const prefix = PathResolver.getPathPrefix(global);
		if (prefix) {
			return join(baseDir, prefix, "skills");
		}
		return join(baseDir, "skills");
	}

	/**
	 * Build component directory path based on installation mode
	 *
	 * @param baseDir - Base directory path
	 * @param component - Component directory name (e.g., "agents", "commands", "workflows", "hooks")
	 * @param global - Whether to use global installation mode
	 * @returns Component directory path
	 * @throws Error if component contains path traversal patterns
	 *
	 * @example
	 * ```typescript
	 * // Local mode
	 * const path = PathResolver.buildComponentPath("/project", "agents", false); // "/project/.claude/agents"
	 * // Global mode
	 * const path = PathResolver.buildComponentPath(PathResolver.getGlobalKitDir(), "agents", true); // "~/.claude/agents"
	 * ```
	 */
	static buildComponentPath(baseDir: string, component: string, global: boolean): string {
		// Validate component to prevent path traversal attacks
		if (!PathResolver.isPathSafe(component)) {
			throw new Error(
				`Invalid component name: "${component}" contains path traversal patterns. Valid names are simple directory names like "agents", "commands", "workflows", "skills", or "hooks".`,
			);
		}

		const prefix = PathResolver.getPathPrefix(global);
		if (prefix) {
			return join(baseDir, prefix, component);
		}
		return join(baseDir, component);
	}
}
