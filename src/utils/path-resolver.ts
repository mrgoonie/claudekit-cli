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
	 * Platform-specific paths:
	 * - macOS: ~/.claude/
	 * - Windows: %APPDATA%/Claude/
	 * - Linux: ~/.claude/
	 */
	static getGlobalKitDir(): string {
		const os = platform();

		if (os === "win32") {
			// Windows: %APPDATA%/Claude/
			const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
			return join(appData, "Claude");
		}

		// macOS/Linux: ~/.claude/
		return join(homedir(), ".claude");
	}
}
