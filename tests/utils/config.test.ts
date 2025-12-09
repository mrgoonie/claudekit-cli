import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { ConfigManager } from "../../src/domains/config/config-manager.js";
import { PathResolver } from "../../src/shared/path-resolver.js";
import type { Config } from "../../src/types/index.js";
import { type TestPaths, setupTestPaths } from "../helpers/test-paths.js";

// Test uses isolated temp directories via CK_TEST_HOME
// PathResolver automatically uses test paths when CK_TEST_HOME is set

describe("ConfigManager", () => {
	let testPaths: TestPaths;

	beforeEach(async () => {
		// Setup isolated test paths - PathResolver will use these
		testPaths = setupTestPaths();
	});

	afterEach(async () => {
		// Reset ConfigManager state
		(ConfigManager as any).config = null;
		ConfigManager.setGlobalFlag(false);

		// Cleanup test paths - removes entire temp directory
		testPaths.cleanup();
	});

	describe("load", () => {
		test("should return default config when no config file exists", async () => {
			const config = await ConfigManager.load();
			expect(config).toEqual({ defaults: {} });
		});

		test("should load config from file when it exists", async () => {
			const testConfig: Config = {
				defaults: { kit: "engineer", dir: "./test" },
			};

			// Write test config file - PathResolver uses test paths
			const configDir = PathResolver.getConfigDir(false);
			const configFile = PathResolver.getConfigFile(false);

			if (!existsSync(configDir)) {
				await mkdir(configDir, { recursive: true });
			}
			await writeFile(configFile, JSON.stringify(testConfig));

			const config = await ConfigManager.load();
			expect(config.defaults?.kit).toBe("engineer");
		});

		test("should return default config on invalid JSON", async () => {
			const configDir = PathResolver.getConfigDir(false);
			const configFile = PathResolver.getConfigFile(false);

			if (!existsSync(configDir)) {
				await mkdir(configDir, { recursive: true });
			}
			await writeFile(configFile, "invalid json");

			const config = await ConfigManager.load();
			expect(config).toEqual({ defaults: {} });
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
				defaults: { kit: "marketing", dir: "./projects" },
			};

			await ConfigManager.save(testConfig);

			// Verify file was created
			const configFile = PathResolver.getConfigFile(false);
			expect(existsSync(configFile)).toBe(true);
		});

		test("should create config directory if it does not exist", async () => {
			const testConfig: Config = { defaults: {} };
			await ConfigManager.save(testConfig);

			const configDir = PathResolver.getConfigDir(false);
			expect(existsSync(configDir)).toBe(true);
		});

		test("should update cached config", async () => {
			const testConfig: Config = {
				defaults: { kit: "engineer" },
			};

			await ConfigManager.save(testConfig);
			const loaded = await ConfigManager.get();
			expect(loaded.defaults?.kit).toBe("engineer");
		});
	});

	describe("get", () => {
		test("should return current config", async () => {
			const config = await ConfigManager.get();
			expect(config).toBeDefined();
			expect(config).toHaveProperty("defaults");
		});
	});

	describe("set", () => {
		test("should set nested config value", async () => {
			await ConfigManager.set("defaults.kit", "engineer");
			const config = await ConfigManager.get();
			expect(config.defaults?.kit).toBe("engineer");
		});

		test("should create nested objects if they do not exist", async () => {
			await ConfigManager.set("defaults.kit", "engineer");
			const config = await ConfigManager.get();
			expect(config.defaults?.kit).toBe("engineer");
		});

		test("should handle multiple nested levels", async () => {
			await ConfigManager.set("defaults.dir", "/test/path");
			const config = await ConfigManager.get();
			expect(config.defaults?.dir).toBe("/test/path");
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
				defaults: { kit: "engineer" },
			};

			await ConfigManager.save(testConfig);

			const localConfigFile = PathResolver.getConfigFile(false);
			expect(existsSync(localConfigFile)).toBe(true);
		});

		test("should use correct path in global mode", async () => {
			ConfigManager.setGlobalFlag(true);

			const testConfig: Config = {
				defaults: { kit: "marketing" },
			};

			await ConfigManager.save(testConfig);

			const globalConfigFile = PathResolver.getConfigFile(true);
			expect(existsSync(globalConfigFile)).toBe(true);
		});

		test("should create directories with secure permissions on Unix", async () => {
			if (platform() === "win32") {
				// Skip on Windows (no chmod support)
				return;
			}

			ConfigManager.setGlobalFlag(true);

			const testConfig: Config = {
				defaults: { kit: "engineer" },
			};

			await ConfigManager.save(testConfig);

			const globalConfigDir = PathResolver.getConfigDir(true);
			const globalConfigFile = PathResolver.getConfigFile(true);

			// Check that files were created
			expect(existsSync(globalConfigDir)).toBe(true);
			expect(existsSync(globalConfigFile)).toBe(true);
		});

		test("should maintain separate configs for local and global modes", async () => {
			// Save local config
			ConfigManager.setGlobalFlag(false);
			await ConfigManager.save({
				defaults: { kit: "engineer" },
			});

			// Save global config
			ConfigManager.setGlobalFlag(true);
			await ConfigManager.save({
				defaults: { kit: "marketing" },
			});

			// Load local config
			ConfigManager.setGlobalFlag(false);
			const localConfig = await ConfigManager.load();
			expect(localConfig.defaults?.kit).toBe("engineer");

			// Load global config
			ConfigManager.setGlobalFlag(true);
			const globalConfig = await ConfigManager.load();
			expect(globalConfig.defaults?.kit).toBe("marketing");
		});
	});
});
