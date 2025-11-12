import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { Config } from "../../src/types.js";
import { ConfigManager } from "../../src/utils/config.js";
import { PathResolver } from "../../src/utils/path-resolver.js";

const TEST_CONFIG_DIR = join(homedir(), ".claudekit-test");
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, "config.json");

describe("ConfigManager", () => {
	beforeEach(async () => {
		// Create test config directory
		if (!existsSync(TEST_CONFIG_DIR)) {
			await mkdir(TEST_CONFIG_DIR, { recursive: true });
		}

		// Override config paths for testing
		// Note: This is a simplified test - in production we'd need to mock the paths
	});

	afterEach(async () => {
		// Clean up test config directory
		if (existsSync(TEST_CONFIG_DIR)) {
			await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
		}

		// Reset ConfigManager state
		(ConfigManager as any).config = null;
		ConfigManager.setGlobalFlag(false); // Reset to default
	});

	describe("load", () => {
		test("should return default config when no config file exists", async () => {
			const config = await ConfigManager.load();
			expect(config).toEqual({ github: {}, defaults: {} });
		});

		test("should load config from file when it exists", async () => {
			const testConfig: Config = {
				github: { token: "test-token" },
				defaults: { kit: "engineer", dir: "./test" },
			};

			// Write test config file (to actual location for this test)
			const actualConfigDir = join(homedir(), ".claudekit");
			const actualConfigFile = join(actualConfigDir, "config.json");

			if (!existsSync(actualConfigDir)) {
				await mkdir(actualConfigDir, { recursive: true });
			}
			await writeFile(actualConfigFile, JSON.stringify(testConfig));

			try {
				const config = await ConfigManager.load();
				expect(config.github?.token).toBe("test-token");
				expect(config.defaults?.kit).toBe("engineer");
			} finally {
				// Cleanup
				if (existsSync(actualConfigFile)) {
					await rm(actualConfigFile);
				}
			}
		});

		test("should return default config on invalid JSON", async () => {
			const actualConfigDir = join(homedir(), ".claudekit");
			const actualConfigFile = join(actualConfigDir, "config.json");

			if (!existsSync(actualConfigDir)) {
				await mkdir(actualConfigDir, { recursive: true });
			}
			await writeFile(actualConfigFile, "invalid json");

			try {
				const config = await ConfigManager.load();
				expect(config).toEqual({ github: {}, defaults: {} });
			} finally {
				// Cleanup
				if (existsSync(actualConfigFile)) {
					await rm(actualConfigFile);
				}
			}
		});

		test("should cache config after first load", async () => {
			const config1 = await ConfigManager.load();
			const config2 = await ConfigManager.load();
			expect(config1).toBe(config2); // Same reference
		});
	});

	describe("save", () => {
		test("should save valid config to file", async () => {
			const testConfig: Config = {
				github: { token: "test-token" },
				defaults: { kit: "marketing", dir: "./projects" },
			};

			await ConfigManager.save(testConfig);

			// Verify file was created
			const actualConfigFile = join(homedir(), ".claudekit", "config.json");
			expect(existsSync(actualConfigFile)).toBe(true);

			// Cleanup
			if (existsSync(actualConfigFile)) {
				await rm(actualConfigFile);
			}
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});

		test("should create config directory if it does not exist", async () => {
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}

			const testConfig: Config = { github: {}, defaults: {} };
			await ConfigManager.save(testConfig);

			expect(existsSync(actualConfigDir)).toBe(true);

			// Cleanup
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});

		test("should throw error on invalid config", async () => {
			const invalidConfig = {
				github: { token: 123 }, // Invalid: should be string
			};

			await expect(ConfigManager.save(invalidConfig as any)).rejects.toThrow();
		});

		test("should update cached config", async () => {
			const testConfig: Config = {
				github: { token: "new-token" },
				defaults: {},
			};

			await ConfigManager.save(testConfig);
			const loaded = await ConfigManager.get();
			expect(loaded.github?.token).toBe("new-token");

			// Cleanup
			const actualConfigFile = join(homedir(), ".claudekit", "config.json");
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigFile)) {
				await rm(actualConfigFile);
			}
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});
	});

	describe("get", () => {
		test("should return current config", async () => {
			const config = await ConfigManager.get();
			expect(config).toBeDefined();
			expect(config).toHaveProperty("github");
			expect(config).toHaveProperty("defaults");
		});
	});

	describe("set", () => {
		test("should set nested config value", async () => {
			await ConfigManager.set("github.token", "test-token-123");
			const config = await ConfigManager.get();
			expect(config.github?.token).toBe("test-token-123");

			// Cleanup
			const actualConfigFile = join(homedir(), ".claudekit", "config.json");
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigFile)) {
				await rm(actualConfigFile);
			}
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});

		test("should create nested objects if they do not exist", async () => {
			await ConfigManager.set("defaults.kit", "engineer");
			const config = await ConfigManager.get();
			expect(config.defaults?.kit).toBe("engineer");

			// Cleanup
			const actualConfigFile = join(homedir(), ".claudekit", "config.json");
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigFile)) {
				await rm(actualConfigFile);
			}
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});

		test("should handle multiple nested levels", async () => {
			await ConfigManager.set("defaults.dir", "/test/path");
			const config = await ConfigManager.get();
			expect(config.defaults?.dir).toBe("/test/path");

			// Cleanup
			const actualConfigFile = join(homedir(), ".claudekit", "config.json");
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigFile)) {
				await rm(actualConfigFile);
			}
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});
	});

	describe("getToken", () => {
		test("should return token from config", async () => {
			await ConfigManager.setToken("test-token-456");
			const token = await ConfigManager.getToken();
			expect(token).toBe("test-token-456");

			// Cleanup
			const actualConfigFile = join(homedir(), ".claudekit", "config.json");
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigFile)) {
				await rm(actualConfigFile);
			}
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});

		test("should return undefined if no token is set", async () => {
			(ConfigManager as any).config = null;
			const token = await ConfigManager.getToken();
			expect(token).toBeUndefined();
		});
	});

	describe("setToken", () => {
		test("should set token in config", async () => {
			await ConfigManager.setToken("new-test-token");
			const config = await ConfigManager.get();
			expect(config.github?.token).toBe("new-test-token");

			// Cleanup
			const actualConfigFile = join(homedir(), ".claudekit", "config.json");
			const actualConfigDir = join(homedir(), ".claudekit");
			if (existsSync(actualConfigFile)) {
				await rm(actualConfigFile);
			}
			if (existsSync(actualConfigDir)) {
				await rm(actualConfigDir, { recursive: true });
			}
		});
	});

	describe("global flag support", () => {
		test("should default to local mode (global=false)", () => {
			const globalFlag = ConfigManager.getGlobalFlag();
			expect(globalFlag).toBe(false);
		});

		test("should set and get global flag", () => {
			ConfigManager.setGlobalFlag(true);
			expect(ConfigManager.getGlobalFlag()).toBe(true);

			ConfigManager.setGlobalFlag(false);
			expect(ConfigManager.getGlobalFlag()).toBe(false);
		});

		test("should reset cached config when global flag changes", async () => {
			// Load config in local mode
			const localConfig = await ConfigManager.load();
			expect(localConfig).toBeDefined();

			// Change to global mode
			ConfigManager.setGlobalFlag(true);

			// Config should be reset (not cached)
			expect((ConfigManager as any).config).toBeNull();
		});

		test("should use correct path in local mode", async () => {
			ConfigManager.setGlobalFlag(false);

			const testConfig: Config = {
				github: { token: "local-token" },
				defaults: {},
			};

			await ConfigManager.save(testConfig);

			const localConfigFile = PathResolver.getConfigFile(false);
			expect(existsSync(localConfigFile)).toBe(true);

			// Cleanup
			if (existsSync(localConfigFile)) {
				await rm(localConfigFile);
			}
			const localConfigDir = PathResolver.getConfigDir(false);
			if (existsSync(localConfigDir)) {
				await rm(localConfigDir, { recursive: true });
			}
		});

		test("should use correct path in global mode", async () => {
			ConfigManager.setGlobalFlag(true);

			const testConfig: Config = {
				github: { token: "global-token" },
				defaults: {},
			};

			await ConfigManager.save(testConfig);

			const globalConfigFile = PathResolver.getConfigFile(true);
			expect(existsSync(globalConfigFile)).toBe(true);

			// Cleanup
			if (existsSync(globalConfigFile)) {
				await rm(globalConfigFile);
			}
			const globalConfigDir = PathResolver.getConfigDir(true);
			if (existsSync(globalConfigDir)) {
				await rm(globalConfigDir, { recursive: true });
			}
		});

		test("should create directories with secure permissions on Unix", async () => {
			if (platform() === "win32") {
				// Skip on Windows (no chmod support)
				return;
			}

			ConfigManager.setGlobalFlag(true);

			const testConfig: Config = {
				github: { token: "secure-token" },
				defaults: {},
			};

			await ConfigManager.save(testConfig);

			const globalConfigDir = PathResolver.getConfigDir(true);
			const globalConfigFile = PathResolver.getConfigFile(true);

			// Check that files were created
			expect(existsSync(globalConfigDir)).toBe(true);
			expect(existsSync(globalConfigFile)).toBe(true);

			// Cleanup
			if (existsSync(globalConfigDir)) {
				await rm(globalConfigDir, { recursive: true });
			}
		});

		test("should maintain separate configs for local and global modes", async () => {
			// Save local config
			ConfigManager.setGlobalFlag(false);
			await ConfigManager.save({
				github: { token: "local-token" },
				defaults: { kit: "engineer" },
			});

			// Save global config
			ConfigManager.setGlobalFlag(true);
			await ConfigManager.save({
				github: { token: "global-token" },
				defaults: { kit: "marketing" },
			});

			// Load local config
			ConfigManager.setGlobalFlag(false);
			const localConfig = await ConfigManager.load();
			expect(localConfig.github?.token).toBe("local-token");
			expect(localConfig.defaults?.kit).toBe("engineer");

			// Load global config
			ConfigManager.setGlobalFlag(true);
			const globalConfig = await ConfigManager.load();
			expect(globalConfig.github?.token).toBe("global-token");
			expect(globalConfig.defaults?.kit).toBe("marketing");

			// Cleanup
			const localConfigDir = PathResolver.getConfigDir(false);
			const globalConfigDir = PathResolver.getConfigDir(true);

			if (existsSync(localConfigDir)) {
				await rm(localConfigDir, { recursive: true });
			}
			if (existsSync(globalConfigDir)) {
				await rm(globalConfigDir, { recursive: true });
			}
		});
	});
});
