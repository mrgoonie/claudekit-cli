import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * Platform-aware path resolver for ClaudeKit configuration directories
 * Follows XDG Base Directory specification for Linux/macOS
 * Uses %LOCALAPPDATA% for Windows
 */
export class PathResolver {
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
		if (!global) {
			// Local mode: backward compatible ~/.claudekit
			return join(homedir(), ".claudekit");
		}

		// Global mode: platform-specific
		const os = platform();

		if (os === "win32") {
			// Windows: Use %LOCALAPPDATA% with fallback
			const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
			return join(localAppData, "claude");
		}

		// macOS/Linux: Use XDG-compliant ~/.config
		const xdgConfigHome = process.env.XDG_CONFIG_HOME;
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
		if (!global) {
			// Local mode: backward compatible ~/.claudekit/cache
			return join(homedir(), ".claudekit", "cache");
		}

		// Global mode: platform-specific
		const os = platform();

		if (os === "win32") {
			// Windows: Use %LOCALAPPDATA%\claude\cache with fallback
			const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
			return join(localAppData, "claude", "cache");
		}

		// macOS/Linux: Use XDG-compliant ~/.cache
		const xdgCacheHome = process.env.XDG_CACHE_HOME;
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
		// All platforms: ~/.claude/
		return join(homedir(), ".claude");
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
		const prefix = PathResolver.getPathPrefix(global);
		if (prefix) {
			return join(baseDir, prefix, component);
		}
		return join(baseDir, component);
	}
}
