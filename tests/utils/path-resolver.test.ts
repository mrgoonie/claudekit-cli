import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver";

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

	describe("isValidComponentName", () => {
		it("should allow safe relative paths", () => {
			expect(PathResolver.isValidComponentName("skills")).toBe(true);
			expect(PathResolver.isValidComponentName("agents")).toBe(true);
			expect(PathResolver.isValidComponentName("test-dir")).toBe(true);
			expect(PathResolver.isValidComponentName("test_dir")).toBe(true);
			expect(PathResolver.isValidComponentName("myComponent123")).toBe(true);
		});

		it("should reject path traversal attempts", () => {
			expect(PathResolver.isValidComponentName("..")).toBe(false);
			expect(PathResolver.isValidComponentName("../etc")).toBe(false);
			expect(PathResolver.isValidComponentName("foo/../bar")).toBe(false);
			expect(PathResolver.isValidComponentName("../../../etc/passwd")).toBe(false);
		});

		it("should reject absolute paths", () => {
			expect(PathResolver.isValidComponentName("/etc/passwd")).toBe(false);
			expect(PathResolver.isValidComponentName("C:\\Windows\\System32")).toBe(false);
		});

		it("should reject home directory expansion", () => {
			expect(PathResolver.isValidComponentName("~")).toBe(false);
			expect(PathResolver.isValidComponentName("~/secret")).toBe(false);
		});

		it("should reject empty or invalid input", () => {
			expect(PathResolver.isValidComponentName("")).toBe(false);
			expect(PathResolver.isValidComponentName(null as any)).toBe(false);
			expect(PathResolver.isValidComponentName(undefined as any)).toBe(false);
		});
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
		it("should return ~/.claude on all platforms", () => {
			const globalKitDir = PathResolver.getGlobalKitDir();
			expect(globalKitDir).toBe(join(homedir(), ".claude"));
		});

		it("should return consistent path regardless of environment variables", () => {
			// Test that it doesn't depend on APPDATA or other env vars
			const originalAppData = process.env.APPDATA;
			process.env.APPDATA = undefined;

			const globalKitDir = PathResolver.getGlobalKitDir();
			expect(globalKitDir).toBe(join(homedir(), ".claude"));

			// Restore
			process.env.APPDATA = originalAppData;
		});
	});

	describe("getPathPrefix", () => {
		it("should return '.claude' for local mode (global=false)", () => {
			const prefix = PathResolver.getPathPrefix(false);
			expect(prefix).toBe(".claude");
		});

		it("should return empty string for global mode (global=true)", () => {
			const prefix = PathResolver.getPathPrefix(true);
			expect(prefix).toBe("");
		});
	});

	describe("buildSkillsPath", () => {
		it("should build skills path with .claude prefix for local mode", () => {
			const basePath = "/test/project";
			const skillsPath = PathResolver.buildSkillsPath(basePath, false);
			expect(skillsPath).toBe(join(basePath, ".claude", "skills"));
		});

		it("should build skills path without prefix for global mode", () => {
			const basePath = "/home/user/.claude";
			const skillsPath = PathResolver.buildSkillsPath(basePath, true);
			expect(skillsPath).toBe(join(basePath, "skills"));
		});

		it("should work with real home directory paths", () => {
			const localPath = PathResolver.buildSkillsPath("/project", false);
			const globalPath = PathResolver.buildSkillsPath(PathResolver.getGlobalKitDir(), true);

			expect(localPath).toBe(join("/project", ".claude", "skills"));
			expect(globalPath).toBe(join(PathResolver.getGlobalKitDir(), "skills"));
		});

		it("should handle different base directories consistently", () => {
			const testDirs = ["/home/user/project", "/tmp/test", "/var/www/app"];

			testDirs.forEach((baseDir) => {
				const localPath = PathResolver.buildSkillsPath(baseDir, false);
				const globalPath = PathResolver.buildSkillsPath(baseDir, true);

				expect(localPath).toBe(join(baseDir, ".claude", "skills"));
				expect(globalPath).toBe(join(baseDir, "skills"));
			});
		});
	});

	describe("buildComponentPath", () => {
		it("should build component path with .claude prefix for local mode", () => {
			const basePath = "/test/project";
			const componentPath = PathResolver.buildComponentPath(basePath, "agents", false);
			expect(componentPath).toBe(join(basePath, ".claude", "agents"));
		});

		it("should build component path without prefix for global mode", () => {
			const basePath = "/home/user/.claude";
			const componentPath = PathResolver.buildComponentPath(basePath, "agents", true);
			expect(componentPath).toBe(join(basePath, "agents"));
		});

		it("should work with different component types", () => {
			const basePath = "/test/project";
			const components = ["agents", "commands", "workflows", "hooks", "skills", "prompts"];

			components.forEach((component) => {
				const localPath = PathResolver.buildComponentPath(basePath, component, false);
				const globalPath = PathResolver.buildComponentPath(basePath, component, true);

				expect(localPath).toBe(join(basePath, ".claude", component));
				expect(globalPath).toBe(join(basePath, component));
			});
		});

		it("should work with real global kit directory", () => {
			const globalKitDir = PathResolver.getGlobalKitDir();
			const componentPath = PathResolver.buildComponentPath(globalKitDir, "agents", true);
			expect(componentPath).toBe(join(globalKitDir, "agents"));
		});

		it("should reject empty or dangerous component names", () => {
			const basePath = "/test/project";

			// Empty component names should throw for security
			expect(() => PathResolver.buildComponentPath(basePath, "", false)).toThrow(
				"Invalid component name",
			);
			expect(() => PathResolver.buildComponentPath(basePath, "", true)).toThrow(
				"Invalid component name",
			);

			// Path traversal attempts should throw
			expect(() => PathResolver.buildComponentPath(basePath, "../etc", false)).toThrow(
				"Invalid component name",
			);
			expect(() => PathResolver.buildComponentPath(basePath, "foo/../bar", true)).toThrow(
				"Invalid component name",
			);
		});

		it("should allow valid component names with special characters", () => {
			const basePath = "/test/project";

			// Hyphens and underscores are valid
			const specialLocal = PathResolver.buildComponentPath(basePath, "test-dir", false);
			const specialGlobal = PathResolver.buildComponentPath(basePath, "test_dir", true);
			expect(specialLocal).toBe(join(basePath, ".claude", "test-dir"));
			expect(specialGlobal).toBe(join(basePath, "test_dir"));
		});
	});

	describe("test mode (CK_TEST_HOME)", () => {
		const originalTestHome = process.env.CK_TEST_HOME;

		afterEach(() => {
			// Restore original test home
			if (originalTestHome) {
				process.env.CK_TEST_HOME = originalTestHome;
			} else {
				process.env.CK_TEST_HOME = undefined;
			}
		});

		it("should use test home for getConfigDir when CK_TEST_HOME is set", () => {
			const testHome = join("/tmp", "test-123");
			process.env.CK_TEST_HOME = testHome;

			const configDir = PathResolver.getConfigDir(false);
			expect(configDir).toBe(join(testHome, ".claudekit"));
		});

		it("should use test home for getCacheDir when CK_TEST_HOME is set", () => {
			const testHome = join("/tmp", "test-123");
			process.env.CK_TEST_HOME = testHome;

			const cacheDir = PathResolver.getCacheDir(false);
			expect(cacheDir).toBe(join(testHome, ".claudekit", "cache"));
		});

		it("should use test home for getGlobalKitDir when CK_TEST_HOME is set", () => {
			const testHome = join("/tmp", "test-123");
			process.env.CK_TEST_HOME = testHome;

			const globalKitDir = PathResolver.getGlobalKitDir();
			expect(globalKitDir).toBe(join(testHome, ".claude"));
		});

		it("should use real paths when CK_TEST_HOME is not set", () => {
			process.env.CK_TEST_HOME = undefined;

			const configDir = PathResolver.getConfigDir(false);
			expect(configDir).toContain(".claudekit");
			expect(configDir).not.toContain("/tmp/test-");

			const cacheDir = PathResolver.getCacheDir(false);
			expect(cacheDir).toContain(".claudekit");
			expect(cacheDir).not.toContain("/tmp/test-");

			const globalKitDir = PathResolver.getGlobalKitDir();
			expect(globalKitDir).toContain(".claude");
			expect(globalKitDir).not.toContain("/tmp/test-");
		});

		it("should maintain separate local/global paths in test mode for getConfigDir", () => {
			const testHome = join("/tmp", "test-456");
			process.env.CK_TEST_HOME = testHome;

			// Test mode simulates real behavior with separate paths
			const configDirLocal = PathResolver.getConfigDir(false);
			const configDirGlobal = PathResolver.getConfigDir(true);

			expect(configDirLocal).toBe(join(testHome, ".claudekit"));
			expect(configDirGlobal).toBe(join(testHome, ".config", "claude"));
			expect(configDirLocal).not.toBe(configDirGlobal);
		});

		it("should maintain separate local/global paths in test mode for getCacheDir", () => {
			const testHome = join("/tmp", "test-456");
			process.env.CK_TEST_HOME = testHome;

			// Test mode simulates real behavior with separate paths
			const cacheDirLocal = PathResolver.getCacheDir(false);
			const cacheDirGlobal = PathResolver.getCacheDir(true);

			expect(cacheDirLocal).toBe(join(testHome, ".claudekit", "cache"));
			expect(cacheDirGlobal).toBe(join(testHome, ".cache", "claude"));
			expect(cacheDirLocal).not.toBe(cacheDirGlobal);
		});

		it("should isolate tests from real user directories", () => {
			// This is the key security test - verify test mode isolation
			const realHome = homedir();
			const testHome = join("/tmp", "isolated-test");
			process.env.CK_TEST_HOME = testHome;

			const configDir = PathResolver.getConfigDir(false);
			const cacheDir = PathResolver.getCacheDir(false);
			const globalKitDir = PathResolver.getGlobalKitDir();

			// None of these should contain the real home directory
			expect(configDir.startsWith(realHome)).toBe(false);
			expect(cacheDir.startsWith(realHome)).toBe(false);
			expect(globalKitDir.startsWith(realHome)).toBe(false);

			// All should be under the test home
			expect(configDir.startsWith(testHome)).toBe(true);
			expect(cacheDir.startsWith(testHome)).toBe(true);
			expect(globalKitDir.startsWith(testHome)).toBe(true);
		});
	});

	describe("HOME directory detection", () => {
		it("isAtHomeDirectory returns true when at HOME", () => {
			const home = homedir();
			expect(PathResolver.isAtHomeDirectory(home)).toBe(true);
		});

		it("isAtHomeDirectory returns false when not at HOME", () => {
			expect(PathResolver.isAtHomeDirectory("/tmp")).toBe(false);
			expect(PathResolver.isAtHomeDirectory("/some/project")).toBe(false);
		});

		it("getLocalClaudeDir returns .claude path for given directory", () => {
			const result = PathResolver.getLocalClaudeDir("/project");
			expect(result).toBe(join("/project", ".claude"));
		});

		it("isLocalSameAsGlobal returns true when at HOME", () => {
			const home = homedir();
			expect(PathResolver.isLocalSameAsGlobal(home)).toBe(true);
		});

		it("isLocalSameAsGlobal returns false when not at HOME", () => {
			expect(PathResolver.isLocalSameAsGlobal("/tmp")).toBe(false);
			expect(PathResolver.isLocalSameAsGlobal("/some/project")).toBe(false);
		});

		it("isLocalSameAsGlobal respects CK_TEST_HOME", () => {
			const testHome = "/tmp/test-home-check";
			process.env.CK_TEST_HOME = testHome;

			// When at test home, local === global
			expect(PathResolver.isLocalSameAsGlobal(testHome)).toBe(true);

			// When not at test home, local !== global
			expect(PathResolver.isLocalSameAsGlobal("/other/path")).toBe(false);

			process.env.CK_TEST_HOME = undefined;
		});
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

		it("should maintain consistency between new and existing methods", () => {
			const baseDir = "/test/project";

			// Test that buildSkillsPath is consistent with getPathPrefix logic
			const localSkillsManual = join(baseDir, PathResolver.getPathPrefix(false), "skills");
			const localSkillsMethod = PathResolver.buildSkillsPath(baseDir, false);
			expect(localSkillsManual).toBe(localSkillsMethod);

			const globalSkillsManual = join(baseDir, PathResolver.getPathPrefix(true), "skills");
			const globalSkillsMethod = PathResolver.buildSkillsPath(baseDir, true);
			expect(globalSkillsManual).toBe(globalSkillsMethod);

			// Test that buildComponentPath is consistent with getPathPrefix logic
			const component = "agents";
			const localComponentManual = join(baseDir, PathResolver.getPathPrefix(false), component);
			const localComponentMethod = PathResolver.buildComponentPath(baseDir, component, false);
			expect(localComponentManual).toBe(localComponentMethod);

			const globalComponentManual = join(baseDir, PathResolver.getPathPrefix(true), component);
			const globalComponentMethod = PathResolver.buildComponentPath(baseDir, component, true);
			expect(globalComponentManual).toBe(globalComponentMethod);
		});
	});
});
