import { afterEach, beforeEach, describe, expect, test } from "bun:test";
/**
 * Tests for portable registry v3.0 migration (Phase 1)
 * Note: These tests use the real ~/.claudekit/ directory
 */
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	type PortableRegistryV3,
	readPortableRegistry,
	writePortableRegistry,
} from "../portable-registry.js";

const REGISTRY_PATH = join(homedir(), ".claudekit", "portable-registry.json");
let backupContent: string | null = null;

beforeEach(async () => {
	// Backup existing registry if present
	if (existsSync(REGISTRY_PATH)) {
		backupContent = await readFile(REGISTRY_PATH, "utf-8");
		await rm(REGISTRY_PATH, { force: true });
	}
});

afterEach(async () => {
	// Restore backup or clean up
	if (backupContent) {
		await writeFile(REGISTRY_PATH, backupContent, "utf-8");
		backupContent = null;
	} else if (existsSync(REGISTRY_PATH)) {
		await rm(REGISTRY_PATH, { force: true });
	}
});

describe("PortableRegistryV3 schema validation", () => {
	test("validates v3.0 registry with all fields", async () => {
		const v3Registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "test-agent",
					type: "agent",
					provider: "claude-code",
					global: true,
					path: "/path/to/agent",
					installedAt: new Date().toISOString(),
					sourcePath: "/source/path",
					cliVersion: "1.0.0",
					sourceChecksum: "a".repeat(64),
					targetChecksum: "b".repeat(64),
					installSource: "kit",
					ownedSections: ["section1", "section2"],
				},
			],
			lastReconciled: new Date().toISOString(),
			appliedManifestVersion: "1.0.0",
		};

		// Should write and read without errors
		await writePortableRegistry(v3Registry);
		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toHaveLength(1);
		expect(loaded.installations[0].sourceChecksum).toBe("a".repeat(64));
		expect(loaded.installations[0].targetChecksum).toBe("b".repeat(64));
		expect(loaded.installations[0].installSource).toBe("kit");
		expect(loaded.installations[0].ownedSections).toEqual(["section1", "section2"]);
	});

	test("validates v3.0 registry without optional fields", async () => {
		const v3Registry: PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "test-command",
					type: "command",
					provider: "cursor",
					global: false,
					path: "/path/to/command",
					installedAt: new Date().toISOString(),
					sourcePath: "/source/path",
					sourceChecksum: "c".repeat(64),
					targetChecksum: "d".repeat(64),
					installSource: "manual",
				},
			],
		};

		await writePortableRegistry(v3Registry);
		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations[0].ownedSections).toBeUndefined();
		expect(loaded.lastReconciled).toBeUndefined();
		expect(loaded.appliedManifestVersion).toBeUndefined();
	});
});

describe("v2.0 to v3.0 migration", () => {
	test("auto-migrates v2.0 registry on read", async () => {
		// Write v2.0 registry
		const v2Registry = {
			version: "2.0",
			installations: [
				{
					item: "test-skill",
					type: "skill",
					provider: "claude-code",
					global: true,
					path: "/path/to/skill",
					installedAt: "2024-01-01T00:00:00Z",
					sourcePath: "/source/skill",
					cliVersion: "0.9.0",
				},
			],
		};

		await writeFile(REGISTRY_PATH, JSON.stringify(v2Registry, null, 2), "utf-8");

		// Read should auto-migrate to v3.0
		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toHaveLength(1);
		expect(loaded.installations[0].item).toBe("test-skill");
		expect(loaded.installations[0].sourceChecksum).toBe("unknown");
		// targetChecksum should be "unknown" since test file doesn't exist
		expect(loaded.installations[0].targetChecksum).toBe("unknown");
		expect(loaded.installations[0].installSource).toBe("kit");
	});

	test("reads target file for targetChecksum during migration", async () => {
		const targetPath = join(homedir(), ".claudekit", "test-target-file.md");
		const targetContent = "# Test Agent\n\nContent here";
		await writeFile(targetPath, targetContent, "utf-8");

		// Write v2.0 registry pointing to real file
		const v2Registry = {
			version: "2.0",
			installations: [
				{
					item: "real-agent",
					type: "agent",
					provider: "cursor",
					global: false,
					path: targetPath,
					installedAt: "2024-01-01T00:00:00Z",
					sourcePath: "/source/agent",
				},
			],
		};

		await writeFile(REGISTRY_PATH, JSON.stringify(v2Registry, null, 2), "utf-8");

		// Read and migrate
		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations[0].targetChecksum).not.toBe("unknown");
		expect(loaded.installations[0].targetChecksum).toMatch(/^[a-f0-9]{64}$/);

		// Cleanup test file
		await rm(targetPath, { force: true });
	});

	test("preserves all v2.0 fields during migration", async () => {
		const v2Registry = {
			version: "2.0",
			installations: [
				{
					item: "my-command",
					type: "command",
					provider: "windsurf",
					global: true,
					path: "/usr/local/commands/my-command.md",
					installedAt: "2024-02-14T12:00:00Z",
					sourcePath: "/claudekit/commands/my-command.md",
					cliVersion: "1.5.0",
				},
			],
		};

		await writeFile(REGISTRY_PATH, JSON.stringify(v2Registry, null, 2), "utf-8");
		const loaded = await readPortableRegistry();

		const inst = loaded.installations[0];
		expect(inst.item).toBe("my-command");
		expect(inst.type).toBe("command");
		expect(inst.provider).toBe("windsurf");
		expect(inst.global).toBe(true);
		expect(inst.path).toBe("/usr/local/commands/my-command.md");
		expect(inst.installedAt).toBe("2024-02-14T12:00:00Z");
		expect(inst.sourcePath).toBe("/claudekit/commands/my-command.md");
		expect(inst.cliVersion).toBe("1.5.0");
	});

	test("handles multiple installations during migration", async () => {
		const v2Registry = {
			version: "2.0",
			installations: [
				{
					item: "agent-1",
					type: "agent",
					provider: "claude-code",
					global: true,
					path: "/path/1",
					installedAt: "2024-01-01T00:00:00Z",
					sourcePath: "/src/1",
				},
				{
					item: "command-1",
					type: "command",
					provider: "cursor",
					global: false,
					path: "/path/2",
					installedAt: "2024-01-02T00:00:00Z",
					sourcePath: "/src/2",
				},
				{
					item: "skill-1",
					type: "skill",
					provider: "windsurf",
					global: true,
					path: "/path/3",
					installedAt: "2024-01-03T00:00:00Z",
					sourcePath: "/src/3",
				},
			],
		};

		await writeFile(REGISTRY_PATH, JSON.stringify(v2Registry, null, 2), "utf-8");
		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toHaveLength(3);

		for (const inst of loaded.installations) {
			expect(inst.sourceChecksum).toBe("unknown");
			expect(inst.installSource).toBe("kit");
		}
	});
});

describe("empty registry initialization", () => {
	test("creates empty v3.0 registry when no file exists", async () => {
		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toEqual([]);
		expect(loaded.lastReconciled).toBeUndefined();
		expect(loaded.appliedManifestVersion).toBeUndefined();
	});
});

describe("v2.0 schema forward compatibility", () => {
	test("v2.0 schema accepts v3.0 fields via passthrough", async () => {
		// This simulates old CLI reading new registry
		const v3Data = {
			version: "2.0", // Old version field
			installations: [
				{
					item: "test",
					type: "agent",
					provider: "claude-code",
					global: true,
					path: "/path",
					installedAt: "2024-01-01T00:00:00Z",
					sourcePath: "/src",
					// v3 fields that old parser should ignore
					sourceChecksum: "abc123",
					targetChecksum: "def456",
					installSource: "kit",
					ownedSections: ["section1"],
				},
			],
		};

		await writeFile(REGISTRY_PATH, JSON.stringify(v3Data, null, 2), "utf-8");

		// Should not throw parse error
		const loaded = await readPortableRegistry();
		expect(loaded.installations).toHaveLength(1);
	});
});
