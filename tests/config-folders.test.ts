import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import { DEFAULT_FOLDERS } from "../src/types.js";
import { ConfigManager } from "../src/utils/config.js";

describe("ConfigManager Folders Support", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `ck-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("loadProjectConfig", () => {
		test("should return null when no config file exists", async () => {
			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result).toBeNull();
		});

		test("should load .claude/.ck.json config with paths key", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "ck-docs",
						plans: "ck-plans",
					},
				}),
			);

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result).not.toBeNull();
			expect(result?.docs).toBe("ck-docs");
			expect(result?.plans).toBe("ck-plans");
		});

		test("should handle flat structure (paths at root)", async () => {
			// Fallback: flat structure without "paths" wrapper
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					docs: "flat-docs",
					plans: "flat-plans",
				}),
			);

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result?.docs).toBe("flat-docs");
			expect(result?.plans).toBe("flat-plans");
		});
	});

	describe("saveProjectConfig", () => {
		test("should save config to .claude/.ck.json with paths key", async () => {
			await ConfigManager.saveProjectConfig(testDir, {
				docs: "saved-docs",
				plans: "saved-plans",
			});

			expect(await pathExists(join(testDir, ".claude", ".ck.json"))).toBe(true);

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result?.docs).toBe("saved-docs");
			expect(result?.plans).toBe("saved-plans");
		});

		test("should save partial config", async () => {
			await ConfigManager.saveProjectConfig(testDir, {
				docs: "only-docs",
			});

			const result = await ConfigManager.loadProjectConfig(testDir);
			expect(result?.docs).toBe("only-docs");
			expect(result?.plans).toBeUndefined();
		});
	});

	describe("resolveFoldersConfig", () => {
		test("should return defaults when no config exists", async () => {
			const result = await ConfigManager.resolveFoldersConfig(testDir);

			expect(result.docs).toBe(DEFAULT_FOLDERS.docs);
			expect(result.plans).toBe(DEFAULT_FOLDERS.plans);
		});

		test("should use project config values", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "project-docs",
						plans: "project-plans",
					},
				}),
			);

			const result = await ConfigManager.resolveFoldersConfig(testDir);

			expect(result.docs).toBe("project-docs");
			expect(result.plans).toBe("project-plans");
		});

		test("should override with CLI options", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "project-docs",
						plans: "project-plans",
					},
				}),
			);

			const result = await ConfigManager.resolveFoldersConfig(testDir, {
				docsDir: "cli-docs",
			});

			expect(result.docs).toBe("cli-docs"); // CLI overrides
			expect(result.plans).toBe("project-plans"); // Config value preserved
		});

		test("should prioritize CLI options over all other sources", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(
				join(testDir, ".claude", ".ck.json"),
				JSON.stringify({
					paths: {
						docs: "project-docs",
						plans: "project-plans",
					},
				}),
			);

			const result = await ConfigManager.resolveFoldersConfig(testDir, {
				docsDir: "cli-docs",
				plansDir: "cli-plans",
			});

			expect(result.docs).toBe("cli-docs");
			expect(result.plans).toBe("cli-plans");
		});
	});

	describe("projectConfigExists", () => {
		test("should return false when no config exists", () => {
			expect(ConfigManager.projectConfigExists(testDir)).toBe(false);
		});

		test("should return true when .claude/.ck.json exists", async () => {
			await mkdir(join(testDir, ".claude"), { recursive: true });
			await writeFile(join(testDir, ".claude", ".ck.json"), "{}");
			expect(ConfigManager.projectConfigExists(testDir)).toBe(true);
		});
	});
});
