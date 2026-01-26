import { existsSync, readFileSync } from "node:fs";
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
 * Detect if running in WSL (Windows Subsystem for Linux)
 */
function isWSL(): boolean {
	try {
		return (
			process.platform === "linux" &&
			existsSync("/proc/version") &&
			readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft")
		);
	} catch {
		return false;
	}
}

/**
 * Normalize WSL paths - convert Windows paths to WSL mount paths
 * Converts: C:\Users\foo -> /mnt/c/Users/foo
 */
function normalizeWSLPath(p: string): string {
	if (!isWSL()) return p;

	// Convert Windows path to WSL path if needed
	const windowsMatch = p.match(/^([A-Za-z]):(.*)/);
	if (windowsMatch) {
		const drive = windowsMatch[1].toLowerCase();
		const rest = windowsMatch[2].replace(/\\/g, "/");
		return `/mnt/${drive}${rest}`;
	}
	return p;
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
	 * Validate a component name to prevent path traversal attacks
	 *
	 * @param name - Component name to validate (e.g., "agents", "skills", "rules")
	 * @returns true if the name is valid, false if it contains traversal patterns
	 *
	 * @example
	 * ```typescript
	 * PathResolver.isValidComponentName("skills"); // true
	 * PathResolver.isValidComponentName("../etc/passwd"); // false
	 * PathResolver.isValidComponentName("folder\\..\\secret"); // false
	 * ```
	 */
	static isValidComponentName(name: string): boolean {
		if (!name || typeof name !== "string") {
			return false;
		}

		// Check BEFORE normalization (to catch "foo/../bar" patterns)
		// and AFTER normalization (to catch "foo/..\\bar" on Windows)
		const dangerousPatterns = [
			"..", // Parent directory traversal
			"~", // Home directory expansion (could be dangerous in some contexts)
		];

		// Check original name for dangerous patterns
		for (const pattern of dangerousPatterns) {
			if (name.includes(pattern)) {
				return false;
			}
		}

		// Normalize name to handle different separators
		const normalized = normalize(name);

		// Check normalized name for dangerous patterns (catches cross-platform issues)
		for (const pattern of dangerousPatterns) {
			if (normalized.includes(pattern)) {
				return false;
			}
		}

		// Check for absolute paths (Unix, Windows drive letter, Windows UNC)
		if (
			name.startsWith("/") ||
			normalized.startsWith("/") ||
			/^[a-zA-Z]:/.test(name) ||
			name.startsWith("\\\\") || // UNC path (\\server\share)
			normalized.startsWith("\\\\")
		) {
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
	 * Get the projects registry file path
	 *
	 * @returns Projects registry path (~/.claudekit/projects.json)
	 */
	static getProjectsRegistryPath(): string {
		return join(PathResolver.getClaudeKitDir(), "projects.json");
	}

	/**
	 * Get the OpenCode configuration directory path
	 *
	 * @param global - Whether to use global installation mode
	 * @param baseDir - Base directory for local mode (defaults to cwd)
	 * @returns OpenCode directory path
	 *
	 * Local mode: {baseDir}/.opencode/
	 * Global mode:
	 *   - All platforms: ~/.config/opencode/ (cross-platform path used by OpenCode)
	 */
	static getOpenCodeDir(global: boolean, baseDir?: string): string {
		// Test mode override
		const testHome = PathResolver.getTestHomeDir();
		if (testHome) {
			return global
				? join(testHome, ".config", "opencode")
				: join(baseDir || testHome, ".opencode");
		}

		if (!global) {
			return join(baseDir || process.cwd(), ".opencode");
		}

		// Global mode: OpenCode uses ~/.config/opencode on all platforms (including Windows)
		// Reference: https://opencode.ai/docs/config/
		const xdgConfigHome = process.env.XDG_CONFIG_HOME;
		if (xdgConfigHome) {
			return join(xdgConfigHome, "opencode");
		}

		return join(homedir(), ".config", "opencode");
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
	 * @param component - Component directory name (e.g., "agents", "commands", "rules", "hooks")
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
		if (!PathResolver.isValidComponentName(component)) {
			throw new Error(
				`Invalid component name: "${component}" contains path traversal patterns. Valid names are simple directory names like "agents", "commands", "rules", "skills", or "hooks".`,
			);
		}

		const prefix = PathResolver.getPathPrefix(global);
		if (prefix) {
			return join(baseDir, prefix, component);
		}
		return join(baseDir, component);
	}

	/**
	 * Get the backup directory for config sync operations
	 * Uses milliseconds + random suffix for uniqueness
	 *
	 * @param timestamp - Optional timestamp for backup directory name
	 * @returns Backup directory path (~/.claudekit/backups/{timestamp}/)
	 *
	 * @example
	 * ```typescript
	 * const backupDir = PathResolver.getBackupDir(); // ~/.claudekit/backups/20251227-123456-789-abc1/
	 * const backupDir = PathResolver.getBackupDir("20251227-123456"); // ~/.claudekit/backups/20251227-123456/
	 * ```
	 */
	static getBackupDir(timestamp?: string): string {
		// Test mode override - use isolated directory
		const testHome = PathResolver.getTestHomeDir();
		const baseDir = testHome ? join(testHome, ".claudekit") : join(homedir(), ".claudekit");

		if (timestamp) {
			return join(baseDir, "backups", timestamp);
		}

		// Use full timestamp with ms + random suffix for uniqueness
		const now = new Date();
		const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const ms = now.getMilliseconds().toString().padStart(3, "0");
		const random = Math.random().toString(36).slice(2, 6);
		const ts = `${dateStr}-${ms}-${random}`;

		return join(baseDir, "backups", ts);
	}

	/**
	 * Normalize path for WSL environments (exported for external use)
	 */
	static normalizeWSLPath(p: string): string {
		return normalizeWSLPath(p);
	}

	/**
	 * Check if running in WSL environment (exported for external use)
	 */
	static isWSL(): boolean {
		return isWSL();
	}

	/**
	 * Check if current working directory is the user's HOME directory
	 * When at HOME, local .claude/ === global .claude/, making scope selection meaningless
	 *
	 * @param cwd - Optional current working directory (defaults to process.cwd())
	 * @returns true if cwd is the home directory
	 */
	static isAtHomeDirectory(cwd?: string): boolean {
		const currentDir = normalize(cwd || process.cwd());
		const homeDir = normalize(homedir());
		return currentDir === homeDir;
	}

	/**
	 * Get local .claude path for a given directory
	 * Returns the path that would be used for local installation
	 *
	 * @param baseDir - Base directory (defaults to process.cwd())
	 * @returns Path to local .claude directory
	 */
	static getLocalClaudeDir(baseDir?: string): string {
		const dir = baseDir || process.cwd();
		return join(dir, ".claude");
	}

	/**
	 * Check if local and global .claude paths are the same
	 * This happens when cwd is HOME directory
	 *
	 * @param cwd - Optional current working directory
	 * @returns true if local and global paths would be identical
	 */
	static isLocalSameAsGlobal(cwd?: string): boolean {
		const localPath = normalize(PathResolver.getLocalClaudeDir(cwd));
		const globalPath = normalize(PathResolver.getGlobalKitDir());
		return localPath === globalPath;
	}
}
