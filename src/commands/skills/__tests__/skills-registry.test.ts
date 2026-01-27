/**
 * Tests for skill registry
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	addInstallation,
	findInstallation,
	getInstallationsForAgent,
	isRegistered,
	readRegistry,
	removeInstallation,
	syncRegistry,
	writeRegistry,
} from "../skills-registry.js";

describe("skill-registry", () => {
	const home = homedir();
	const registryPath = join(home, ".claudekit", "skill-registry.json");

	// Store original registry if exists
	let originalRegistry: string | null = null;

	beforeAll(() => {
		// Backup existing registry
		if (existsSync(registryPath)) {
			const { readFileSync } = require("node:fs");
			originalRegistry = readFileSync(registryPath, "utf-8");
		}
	});

	afterAll(async () => {
		// Restore original registry
		if (originalRegistry) {
			writeFileSync(registryPath, originalRegistry, "utf-8");
		} else if (existsSync(registryPath)) {
			// Clear test data by writing empty registry
			await writeRegistry({ version: "1.0", installations: [] });
		}
	});

	describe("readRegistry", () => {
		it("should return empty registry if file does not exist", async () => {
			// Temporarily rename registry
			const tempPath = `${registryPath}.temp`;
			if (existsSync(registryPath)) {
				const { renameSync } = require("node:fs");
				renameSync(registryPath, tempPath);
			}

			try {
				const registry = await readRegistry();
				expect(registry.version).toBe("1.0");
				expect(registry.installations).toEqual([]);
			} finally {
				// Restore
				if (existsSync(tempPath)) {
					const { renameSync } = require("node:fs");
					renameSync(tempPath, registryPath);
				}
			}
		});

		it("should read valid registry file", async () => {
			const testRegistry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "test-skill",
						agent: "claude-code",
						global: true,
						path: "/test/path",
						installedAt: new Date().toISOString(),
						sourcePath: "/source/path",
					},
				],
			};
			await writeRegistry(testRegistry);

			const registry = await readRegistry();
			expect(registry.version).toBe("1.0");
			expect(registry.installations.length).toBeGreaterThanOrEqual(1);
		});

		it("should return empty registry for corrupted file", async () => {
			// Write invalid JSON
			mkdirSync(join(home, ".claudekit"), { recursive: true });
			writeFileSync(registryPath, "invalid json {{{", "utf-8");

			const registry = await readRegistry();
			expect(registry.version).toBe("1.0");
			expect(registry.installations).toEqual([]);
		});
	});

	describe("writeRegistry", () => {
		it("should create registry file and parent directory", async () => {
			const testRegistry = {
				version: "1.0" as const,
				installations: [],
			};

			await writeRegistry(testRegistry);
			expect(existsSync(registryPath)).toBe(true);
		});

		it("should write valid JSON", async () => {
			const testRegistry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "write-test",
						agent: "cursor",
						global: false,
						path: "/test",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};

			await writeRegistry(testRegistry);
			const registry = await readRegistry();
			expect(registry.installations.some((i) => i.skill === "write-test")).toBe(true);
		});
	});

	describe("addInstallation", () => {
		it("should add new installation to registry", async () => {
			// Start with empty registry
			await writeRegistry({ version: "1.0", installations: [] });

			await addInstallation("new-skill", "claude-code", true, "/install/path", "/source/path");

			const registry = await readRegistry();
			const found = registry.installations.find((i) => i.skill === "new-skill");
			expect(found).toBeDefined();
			expect(found?.agent).toBe("claude-code");
			expect(found?.global).toBe(true);
		});

		it("should update existing installation (same skill+agent+global)", async () => {
			await writeRegistry({ version: "1.0", installations: [] });

			// Add initial
			await addInstallation("update-skill", "cursor", false, "/path/v1", "/src/v1");
			// Update
			await addInstallation("update-skill", "cursor", false, "/path/v2", "/src/v2");

			const registry = await readRegistry();
			const matches = registry.installations.filter(
				(i) => i.skill === "update-skill" && i.agent === "cursor" && !i.global,
			);
			expect(matches.length).toBe(1);
			expect(matches[0].path).toBe("/path/v2");
		});

		it("should keep separate entries for different agents", async () => {
			await writeRegistry({ version: "1.0", installations: [] });

			await addInstallation("multi-agent", "claude-code", true, "/path/claude", "/src");
			await addInstallation("multi-agent", "cursor", true, "/path/cursor", "/src");

			const registry = await readRegistry();
			const matches = registry.installations.filter((i) => i.skill === "multi-agent");
			expect(matches.length).toBe(2);
		});

		it("should record installedAt timestamp", async () => {
			await writeRegistry({ version: "1.0", installations: [] });

			const before = Date.now();
			await addInstallation("timestamp-test", "codex", true, "/path", "/src");
			const after = Date.now();

			const registry = await readRegistry();
			const found = registry.installations.find((i) => i.skill === "timestamp-test");
			expect(found).toBeDefined();
			const installedAt = new Date(found?.installedAt ?? "").getTime();

			expect(installedAt).toBeGreaterThanOrEqual(before);
			expect(installedAt).toBeLessThanOrEqual(after);
		});
	});

	describe("removeInstallation", () => {
		it("should remove existing installation", async () => {
			await writeRegistry({
				version: "1.0",
				installations: [
					{
						skill: "to-remove",
						agent: "claude-code",
						global: true,
						path: "/path",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			});

			const removed = await removeInstallation("to-remove", "claude-code", true);
			expect(removed).not.toBeNull();
			expect(removed?.skill).toBe("to-remove");

			const registry = await readRegistry();
			expect(registry.installations.find((i) => i.skill === "to-remove")).toBeUndefined();
		});

		it("should return null for non-existent installation", async () => {
			await writeRegistry({ version: "1.0", installations: [] });

			const removed = await removeInstallation("non-existent", "cursor", false);
			expect(removed).toBeNull();
		});

		it("should only remove matching skill+agent+global combo", async () => {
			await writeRegistry({
				version: "1.0",
				installations: [
					{
						skill: "shared-name",
						agent: "claude-code",
						global: true,
						path: "/global",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "shared-name",
						agent: "claude-code",
						global: false,
						path: "/project",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			});

			await removeInstallation("shared-name", "claude-code", true);

			const registry = await readRegistry();
			const remaining = registry.installations.filter((i) => i.skill === "shared-name");
			expect(remaining.length).toBe(1);
			expect(remaining[0].global).toBe(false);
		});
	});

	describe("findInstallation", () => {
		it("should find by skill name (case insensitive)", async () => {
			const registry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "find-test",
						agent: "claude-code",
						global: true,
						path: "/global",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "find-test",
						agent: "cursor",
						global: false,
						path: "/project",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};
			const found = findInstallation(registry, "FIND-TEST");
			expect(found.length).toBe(2);
		});

		it("should filter by agent", async () => {
			const registry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "find-test",
						agent: "claude-code",
						global: true,
						path: "/global",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "find-test",
						agent: "cursor",
						global: false,
						path: "/project",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};
			const found = findInstallation(registry, "find-test", "cursor");
			expect(found.length).toBe(1);
			expect(found[0].agent).toBe("cursor");
		});

		it("should filter by global flag", async () => {
			const registry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "find-test",
						agent: "claude-code",
						global: true,
						path: "/global",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "find-test",
						agent: "cursor",
						global: false,
						path: "/project",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};
			const found = findInstallation(registry, "find-test", undefined, true);
			expect(found.length).toBe(1);
			expect(found[0].global).toBe(true);
		});

		it("should return empty array for no matches", async () => {
			const registry = { version: "1.0" as const, installations: [] };
			const found = findInstallation(registry, "non-existent");
			expect(found).toEqual([]);
		});
	});

	describe("getInstallationsForAgent", () => {
		it("should return all installations for agent", () => {
			const registry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "skill-a",
						agent: "claude-code",
						global: true,
						path: "/a",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "skill-b",
						agent: "cursor",
						global: true,
						path: "/b",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};
			const installations = getInstallationsForAgent(registry, "claude-code");
			expect(installations.length).toBe(1);
			expect(installations.every((i) => i.agent === "claude-code")).toBe(true);
		});

		it("should filter by global flag", () => {
			const registry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "skill-a",
						agent: "claude-code",
						global: true,
						path: "/a",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
					{
						skill: "skill-b",
						agent: "claude-code",
						global: false,
						path: "/b",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};
			const globalOnly = getInstallationsForAgent(registry, "claude-code", true);
			expect(globalOnly.length).toBe(1);
			expect(globalOnly.every((i) => i.global)).toBe(true);
		});
	});

	describe("isRegistered", () => {
		it("should return true for registered skill", () => {
			const registry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "find-test",
						agent: "claude-code",
						global: true,
						path: "/global",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};
			const result = isRegistered(registry, "find-test", "claude-code", true);
			expect(result).toBe(true);
		});

		it("should return false for unregistered skill", () => {
			const registry = { version: "1.0" as const, installations: [] };
			const result = isRegistered(registry, "unregistered", "cursor", false);
			expect(result).toBe(false);
		});

		it("should be case insensitive for skill name", () => {
			const registry = {
				version: "1.0" as const,
				installations: [
					{
						skill: "find-test",
						agent: "claude-code",
						global: true,
						path: "/global",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			};
			const result = isRegistered(registry, "FIND-TEST", "claude-code", true);
			expect(result).toBe(true);
		});
	});

	describe("syncRegistry", () => {
		it("should remove orphaned entries (file deleted)", async () => {
			await writeRegistry({
				version: "1.0",
				installations: [
					{
						skill: "orphan-skill",
						agent: "claude-code",
						global: true,
						path: "/non/existent/path/that/does/not/exist",
						installedAt: new Date().toISOString(),
						sourcePath: "/src",
					},
				],
			});

			const { removed } = await syncRegistry();
			expect(removed.length).toBe(1);
			expect(removed[0].skill).toBe("orphan-skill");

			const registry = await readRegistry();
			expect(registry.installations.find((i) => i.skill === "orphan-skill")).toBeUndefined();
		});

		it("should keep valid entries", async () => {
			// Create a real directory to reference
			const realPath = join(home, ".claudekit", "sync-test-skill");
			mkdirSync(realPath, { recursive: true });

			try {
				await writeRegistry({
					version: "1.0",
					installations: [
						{
							skill: "real-skill",
							agent: "claude-code",
							global: true,
							path: realPath,
							installedAt: new Date().toISOString(),
							sourcePath: "/src",
						},
					],
				});

				const { removed } = await syncRegistry();
				expect(removed.length).toBe(0);

				const registry = await readRegistry();
				expect(registry.installations.find((i) => i.skill === "real-skill")).toBeDefined();
			} finally {
				rmSync(realPath, { recursive: true, force: true });
			}
		});
	});
});
