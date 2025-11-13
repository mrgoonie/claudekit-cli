import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { PathResolver } from "../../src/utils/path-resolver";

describe("PathResolver", () => {
	const originalPlatform = platform();
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Reset environment
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		// Restore environment
		process.env = originalEnv;
	});

	describe("getConfigDir", () => {
		it("should return ~/.claudekit for local mode (default)", () => {
			const configDir = PathResolver.getConfigDir(false);
			expect(configDir).toBe(join(homedir(), ".claudekit"));
		});

		it("should return ~/.claudekit when global flag is false", () => {
			const configDir = PathResolver.getConfigDir(false);
			expect(configDir).toBe(join(homedir(), ".claudekit"));
		});

		if (originalPlatform === "win32") {
			it("should return %LOCALAPPDATA%/claude for global mode on Windows", () => {
				const localAppData = process.env.LOCALAPPDATA || "C:\\Users\\Test\\AppData\\Local";
				process.env.LOCALAPPDATA = localAppData;

				const configDir = PathResolver.getConfigDir(true);
				expect(configDir).toBe(join(localAppData, "claude"));
			});

			it("should use fallback if LOCALAPPDATA is not set on Windows", () => {
				process.env.LOCALAPPDATA = undefined;

				const configDir = PathResolver.getConfigDir(true);
				expect(configDir).toBe(join(homedir(), "AppData", "Local", "claude"));
			});
		} else {
			it("should return ~/.config/claude for global mode on Unix (no XDG_CONFIG_HOME)", () => {
				process.env.XDG_CONFIG_HOME = undefined;

				const configDir = PathResolver.getConfigDir(true);
				expect(configDir).toBe(join(homedir(), ".config", "claude"));
			});

			it("should respect XDG_CONFIG_HOME for global mode on Unix", () => {
				const customXdgConfig = "/custom/config";
				process.env.XDG_CONFIG_HOME = customXdgConfig;

				const configDir = PathResolver.getConfigDir(true);
				expect(configDir).toBe(join(customXdgConfig, "claude"));
			});
		}
	});

	describe("getConfigFile", () => {
		it("should return config.json in local mode directory", () => {
			const configFile = PathResolver.getConfigFile(false);
			expect(configFile).toBe(join(homedir(), ".claudekit", "config.json"));
		});

		it("should return config.json in global mode directory", () => {
			if (originalPlatform === "win32") {
				const localAppData = process.env.LOCALAPPDATA || "C:\\Users\\Test\\AppData\\Local";
				process.env.LOCALAPPDATA = localAppData;

				const configFile = PathResolver.getConfigFile(true);
				expect(configFile).toBe(join(localAppData, "claude", "config.json"));
			} else {
				process.env.XDG_CONFIG_HOME = undefined;

				const configFile = PathResolver.getConfigFile(true);
				expect(configFile).toBe(join(homedir(), ".config", "claude", "config.json"));
			}
		});
	});

	describe("getCacheDir", () => {
		it("should return ~/.claudekit/cache for local mode", () => {
			const cacheDir = PathResolver.getCacheDir(false);
			expect(cacheDir).toBe(join(homedir(), ".claudekit", "cache"));
		});

		if (originalPlatform === "win32") {
			it("should return %LOCALAPPDATA%/claude/cache for global mode on Windows", () => {
				const localAppData = process.env.LOCALAPPDATA || "C:\\Users\\Test\\AppData\\Local";
				process.env.LOCALAPPDATA = localAppData;

				const cacheDir = PathResolver.getCacheDir(true);
				expect(cacheDir).toBe(join(localAppData, "claude", "cache"));
			});

			it("should use fallback if LOCALAPPDATA is not set on Windows", () => {
				process.env.LOCALAPPDATA = undefined;

				const cacheDir = PathResolver.getCacheDir(true);
				expect(cacheDir).toBe(join(homedir(), "AppData", "Local", "claude", "cache"));
			});
		} else {
			it("should return ~/.cache/claude for global mode on Unix (no XDG_CACHE_HOME)", () => {
				process.env.XDG_CACHE_HOME = undefined;

				const cacheDir = PathResolver.getCacheDir(true);
				expect(cacheDir).toBe(join(homedir(), ".cache", "claude"));
			});

			it("should respect XDG_CACHE_HOME for global mode on Unix", () => {
				const customXdgCache = "/custom/cache";
				process.env.XDG_CACHE_HOME = customXdgCache;

				const cacheDir = PathResolver.getCacheDir(true);
				expect(cacheDir).toBe(join(customXdgCache, "claude"));
			});
		}
	});

	describe("getGlobalKitDir", () => {
		if (originalPlatform === "win32") {
			it("should return %APPDATA%/Claude on Windows", () => {
				const appData = process.env.APPDATA || "C:\\Users\\Test\\AppData\\Roaming";
				process.env.APPDATA = appData;

				const globalKitDir = PathResolver.getGlobalKitDir();
				expect(globalKitDir).toBe(join(appData, "Claude"));
			});

			it("should use fallback if APPDATA is not set on Windows", () => {
				process.env.APPDATA = undefined;

				const globalKitDir = PathResolver.getGlobalKitDir();
				expect(globalKitDir).toBe(join(homedir(), "AppData", "Roaming", "Claude"));
			});
		} else {
			it("should return ~/.claude on Unix", () => {
				const globalKitDir = PathResolver.getGlobalKitDir();
				expect(globalKitDir).toBe(join(homedir(), ".claude"));
			});
		}
	});

	describe("path consistency", () => {
		it("should maintain separate paths for local and global modes", () => {
			const localConfig = PathResolver.getConfigDir(false);
			const globalConfig = PathResolver.getConfigDir(true);

			// Local and global should be different
			expect(localConfig).not.toBe(globalConfig);

			// Local should always be ~/.claudekit
			expect(localConfig).toBe(join(homedir(), ".claudekit"));
		});

		it("should use consistent cache directories per mode", () => {
			const localCache = PathResolver.getCacheDir(false);
			const globalCache = PathResolver.getCacheDir(true);

			// Local and global cache should be different
			expect(localCache).not.toBe(globalCache);

			// Local cache should be under local config
			expect(localCache).toBe(join(PathResolver.getConfigDir(false), "cache"));
		});
	});
});
