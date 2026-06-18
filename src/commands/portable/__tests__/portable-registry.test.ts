import { afterEach, beforeEach, describe, expect, test } from "bun:test";
/**
 * Tests for portable registry v3.0 migration (Phase 1)
 * Note: These tests isolate ~/.claudekit/ through CK_TEST_HOME.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { PortableRegistryV3 } from "../portable-registry.js";

// Load an isolated module instance so Bun's global module mocks in sibling tests cannot
// replace addPortableInstallation with a no-op during full-suite CI runs.
const portableRegistryTestModule = "../portable-registry.js?portable-registry-test";
const {
	addPortableInstallation,
	readPortableRegistry,
	removeInstallationsByFilter,
	removePortableInstallation,
	updateAppliedManifestVersion,
	writePortableRegistry,
} = (await import(portableRegistryTestModule)) as typeof import("../portable-registry.js");

const originalCkTestHome = process.env.CK_TEST_HOME;
let testHome: string | null = null;
let testFilesToRemove: string[] = [];

function getRegistryDir(): string {
	if (!testHome) {
		throw new Error("testHome is not initialized");
	}
	return join(testHome, ".claudekit");
}

function getRegistryPath(): string {
	return join(getRegistryDir(), "portable-registry.json");
}

function getMigrationLockPath(): string {
	return join(getRegistryDir(), ".migration.lock");
}

async function readTestPortableRegistry(): Promise<PortableRegistryV3> {
	return JSON.parse(await readFile(getRegistryPath(), "utf-8")) as PortableRegistryV3;
}

function pinTestHome(): void {
	if (!testHome) {
		throw new Error("testHome is not initialized");
	}
	process.env.CK_TEST_HOME = testHome;
}

beforeEach(async () => {
	testHome = await mkdtemp(join(tmpdir(), "ck-portable-registry-"));
	pinTestHome();
	await mkdir(getRegistryDir(), { recursive: true });
});

afterEach(async () => {
	for (const path of testFilesToRemove) {
		await rm(path, { force: true });
	}
	testFilesToRemove = [];

	if (testHome) {
		await rm(testHome, { recursive: true, force: true });
		testHome = null;
	}

	if (originalCkTestHome === undefined) {
		Reflect.deleteProperty(process.env, "CK_TEST_HOME");
	} else {
		process.env.CK_TEST_HOME = originalCkTestHome;
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

		await writeFile(getRegistryPath(), JSON.stringify(v2Registry, null, 2), "utf-8");

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
		const targetPath = join(getRegistryDir(), "test-target-file.md");
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

		await writeFile(getRegistryPath(), JSON.stringify(v2Registry, null, 2), "utf-8");

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

		await writeFile(getRegistryPath(), JSON.stringify(v2Registry, null, 2), "utf-8");
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

		await writeFile(getRegistryPath(), JSON.stringify(v2Registry, null, 2), "utf-8");
		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toHaveLength(3);

		for (const inst of loaded.installations) {
			expect(inst.sourceChecksum).toBe("unknown");
			expect(inst.installSource).toBe("kit");
		}
	});
});

describe("stale v3.0 registry repair", () => {
	test("repairs v3.0 entries missing idempotency fields", async () => {
		const staleRegistry = {
			version: "3.0",
			installations: [
				{
					item: "scout",
					type: "skill",
					provider: "codex",
					global: true,
					path: "/path/to/scout",
					installedAt: "2026-05-09T00:00:00.000Z",
					sourcePath: "/source/scout",
				},
				{
					item: "review",
					type: "command",
					provider: "claude-code",
					global: false,
					path: "/path/to/review",
					installedAt: "2026-05-09T00:00:00.000Z",
					sourcePath: "/source/review",
					sourceChecksum: "existing-source",
					targetChecksum: "existing-target",
					installSource: "manual",
					ownedSections: ["frontmatter"],
				},
			],
			lastReconciled: "2026-05-09T00:00:00.000Z",
			customTopLevel: "preserved",
		};

		await writeFile(getRegistryPath(), JSON.stringify(staleRegistry, null, 2), "utf-8");

		const loaded = await readPortableRegistry();

		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toHaveLength(2);
		expect(loaded.installations[0].sourceChecksum).toBe("unknown");
		expect(loaded.installations[0].targetChecksum).toBe("unknown");
		expect(loaded.installations[0].installSource).toBe("kit");
		expect(loaded.installations[1].sourceChecksum).toBe("existing-source");
		expect(loaded.installations[1].targetChecksum).toBe("existing-target");
		expect(loaded.installations[1].installSource).toBe("manual");
		expect(loaded.installations[1].ownedSections).toEqual(["frontmatter"]);
		expect(loaded.lastReconciled).toBe("2026-05-09T00:00:00.000Z");

		const persistedRaw = JSON.parse(await readFile(getRegistryPath(), "utf-8")) as {
			customTopLevel?: string;
			installations: Array<{
				sourceChecksum?: string;
				targetChecksum?: string;
				installSource?: string;
			}>;
		};
		expect(persistedRaw.customTopLevel).toBe("preserved");
		expect(persistedRaw.installations[0].sourceChecksum).toBe("unknown");
		expect(persistedRaw.installations[0].targetChecksum).toBe("unknown");
		expect(persistedRaw.installations[0].installSource).toBe("kit");
	});

	test("computes target checksum from disk while repairing stale v3.0 entries", async () => {
		const targetPath = join(getRegistryDir(), `test-stale-v3-target-${process.pid}.md`);
		testFilesToRemove.push(targetPath);
		await mkdir(getRegistryDir(), { recursive: true });
		const targetContent = "# Existing target\n\nContent on disk";
		const expectedChecksum = createHash("sha256").update(targetContent, "utf-8").digest("hex");
		await writeFile(targetPath, targetContent, "utf-8");

		const staleRegistry = {
			version: "3.0",
			installations: [
				{
					item: "disk-backed-skill",
					type: "skill",
					provider: "codex",
					global: true,
					path: targetPath,
					installedAt: "2026-05-09T00:00:00.000Z",
					sourcePath: "/source/disk-backed-skill",
				},
			],
		};

		await writeFile(getRegistryPath(), JSON.stringify(staleRegistry, null, 2), "utf-8");

		const loaded = await readPortableRegistry();

		expect(loaded.installations[0].targetChecksum).toBe(expectedChecksum);
		expect(loaded.installations[0].targetChecksum).toMatch(/^[a-f0-9]{64}$/);

		const persistedRaw = JSON.parse(await readFile(getRegistryPath(), "utf-8")) as {
			installations: Array<{ targetChecksum?: string }>;
		};
		expect(persistedRaw.installations[0].targetChecksum).toBe(
			loaded.installations[0].targetChecksum,
		);
	});

	test("returns repaired view without persisting when migration lock is active", async () => {
		const staleRegistry = {
			version: "3.0",
			installations: [
				{
					item: "scout",
					type: "skill",
					provider: "codex",
					global: true,
					path: "/path/to/scout",
					installedAt: "2026-05-09T00:00:00.000Z",
					sourcePath: "/source/scout",
				},
			],
		};

		await writeFile(getRegistryPath(), JSON.stringify(staleRegistry, null, 2), "utf-8");
		await writeFile(getMigrationLockPath(), String(Date.now()), "utf-8");

		const loaded = await readPortableRegistry();

		expect(loaded.installations[0].sourceChecksum).toBe("unknown");
		expect(loaded.installations[0].targetChecksum).toBe("unknown");
		expect(loaded.installations[0].installSource).toBe("kit");

		const persistedRaw = JSON.parse(await readFile(getRegistryPath(), "utf-8")) as {
			installations: Array<{
				sourceChecksum?: string;
				targetChecksum?: string;
				installSource?: string;
			}>;
		};
		expect(persistedRaw.installations[0].sourceChecksum).toBeUndefined();
		expect(persistedRaw.installations[0].targetChecksum).toBeUndefined();
		expect(persistedRaw.installations[0].installSource).toBeUndefined();
	});

	test("rejects corrupted v3.0 idempotency fields", async () => {
		const corruptedRegistry = {
			version: "3.0",
			installations: [
				{
					item: "scout",
					type: "skill",
					provider: "codex",
					global: true,
					path: "/path/to/scout",
					installedAt: "2026-05-09T00:00:00.000Z",
					sourcePath: "/source/scout",
					sourceChecksum: "source",
					targetChecksum: "target",
					installSource: "local",
				},
			],
		};

		await writeFile(getRegistryPath(), JSON.stringify(corruptedRegistry, null, 2), "utf-8");

		await expect(readPortableRegistry()).rejects.toThrow(
			"portable-registry.json has unsupported schema/version",
		);
	});
});

describe("invalid registry handling", () => {
	test("keeps invalid JSON fatal", async () => {
		await writeFile(getRegistryPath(), "{ invalid json", "utf-8");

		await expect(readPortableRegistry()).rejects.toThrow(
			"portable-registry.json is not valid JSON",
		);
	});

	test("keeps unsupported top-level versions fatal", async () => {
		await writeFile(
			getRegistryPath(),
			JSON.stringify({ version: "4.0", installations: [] }, null, 2),
			"utf-8",
		);

		await expect(readPortableRegistry()).rejects.toThrow(
			"portable-registry.json has unsupported schema/version",
		);
	});
});

describe("migration lock handling", () => {
	test("treats invalid lock timestamp as active lock and skips persisted migration", async () => {
		const v2Registry = {
			version: "2.0",
			installations: [
				{
					item: "locked-item",
					type: "agent",
					provider: "claude-code",
					global: true,
					path: "/tmp/locked-item.md",
					installedAt: "2024-01-01T00:00:00Z",
					sourcePath: "/source/locked-item.md",
				},
			],
		};

		await writeFile(getRegistryPath(), JSON.stringify(v2Registry, null, 2), "utf-8");
		await writeFile(getMigrationLockPath(), "invalid-timestamp", "utf-8");

		const loaded = await readPortableRegistry();
		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toHaveLength(1);
		expect(existsSync(getMigrationLockPath())).toBe(true);

		const persistedRaw = JSON.parse(await readFile(getRegistryPath(), "utf-8")) as {
			version: string;
		};
		expect(persistedRaw.version).toBe("2.0");
	});

	test("cleans stale lock and proceeds with persisted migration", async () => {
		const v2Registry = {
			version: "2.0",
			installations: [
				{
					item: "stale-lock-item",
					type: "command",
					provider: "codex",
					global: true,
					path: "/tmp/stale-lock-item.md",
					installedAt: "2024-01-01T00:00:00Z",
					sourcePath: "/source/stale-lock-item.md",
				},
			],
		};

		await writeFile(getRegistryPath(), JSON.stringify(v2Registry, null, 2), "utf-8");
		await writeFile(getMigrationLockPath(), String(Date.now() - 120000), "utf-8");

		const loaded = await readPortableRegistry();
		expect(loaded.version).toBe("3.0");
		expect(loaded.installations).toHaveLength(1);

		const persistedRaw = JSON.parse(await readFile(getRegistryPath(), "utf-8")) as {
			version: string;
		};
		expect(persistedRaw.version).toBe("3.0");
		expect(existsSync(getMigrationLockPath())).toBe(false);
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

// Phase 04: appliedManifestVersion advancement and stale entry cleanup
describe("updateAppliedManifestVersion", () => {
	test("writes appliedManifestVersion to registry atomically", async () => {
		// Start with empty registry
		await writePortableRegistry({ version: "3.0", installations: [] });

		await updateAppliedManifestVersion("3.43.0");

		const loaded = await readPortableRegistry();
		expect(loaded.appliedManifestVersion).toBe("3.43.0");
	});

	test("overwrites previous appliedManifestVersion on re-run (idempotency)", async () => {
		await writePortableRegistry({
			version: "3.0",
			installations: [],
			appliedManifestVersion: "3.42.2",
		});

		await updateAppliedManifestVersion("3.43.0");

		const loaded = await readPortableRegistry();
		// Must advance from old value to new value — re-run is safe
		expect(loaded.appliedManifestVersion).toBe("3.43.0");
	});

	test("preserves existing installations when updating appliedManifestVersion", async () => {
		await writePortableRegistry({
			version: "3.0",
			installations: [
				{
					item: "scout",
					type: "skill",
					provider: "cursor",
					global: false,
					path: ".cursor/skills/scout",
					installedAt: new Date().toISOString(),
					sourcePath: ".claude/skills/scout",
					sourceChecksum: "a".repeat(64),
					targetChecksum: "b".repeat(64),
					installSource: "kit",
				},
			],
		});

		await updateAppliedManifestVersion("3.43.0");

		const loaded = await readPortableRegistry();
		expect(loaded.appliedManifestVersion).toBe("3.43.0");
		expect(loaded.installations).toHaveLength(1);
		expect(loaded.installations[0].item).toBe("scout");
	});
});

describe("removeInstallationsByFilter (stale entry cleanup)", () => {
	test("removes stale registry entry at old path (.agents/skills) leaving new-path entry intact", async () => {
		await writePortableRegistry({
			version: "3.0",
			installations: [
				{
					item: "scout",
					type: "skill",
					provider: "cursor",
					global: false,
					// stale entry: old .agents/skills path
					path: ".agents/skills/scout",
					installedAt: new Date().toISOString(),
					sourcePath: ".claude/skills/scout",
					sourceChecksum: "a".repeat(64),
					targetChecksum: "b".repeat(64),
					installSource: "kit",
				},
				{
					item: "debug",
					type: "skill",
					provider: "windsurf",
					global: false,
					// current entry: new native path
					path: ".windsurf/skills/debug",
					installedAt: new Date().toISOString(),
					sourcePath: ".claude/skills/debug",
					sourceChecksum: "c".repeat(64),
					targetChecksum: "d".repeat(64),
					installSource: "kit",
				},
			],
		});

		// Simulate detectPathMigrations delete action: remove entries at stale path
		const removed = await removeInstallationsByFilter((entry) =>
			entry.path.includes(".agents/skills"),
		);

		expect(removed).toHaveLength(1);
		expect(removed[0].item).toBe("scout");

		const loaded = await readPortableRegistry();
		// stale entry gone
		expect(loaded.installations.some((i) => i.path.includes(".agents/skills"))).toBe(false);
		// new-path entry survives
		expect(loaded.installations).toHaveLength(1);
		expect(loaded.installations[0].item).toBe("debug");
	});

	test("returns empty array when no entries match filter", async () => {
		await writePortableRegistry({
			version: "3.0",
			installations: [
				{
					item: "scout",
					type: "skill",
					provider: "cursor",
					global: false,
					path: ".cursor/skills/scout",
					installedAt: new Date().toISOString(),
					sourcePath: ".claude/skills/scout",
					sourceChecksum: "a".repeat(64),
					targetChecksum: "b".repeat(64),
					installSource: "kit",
				},
			],
		});

		const removed = await removeInstallationsByFilter((entry) =>
			entry.path.includes(".agents/skills"),
		);

		expect(removed).toHaveLength(0);

		const loaded = await readPortableRegistry();
		expect(loaded.installations).toHaveLength(1);
	});
});

describe("addPortableInstallation (path alignment for cursor/windsurf)", () => {
	test("records cursor skill at .cursor/skills/<name> path", async () => {
		pinTestHome();
		await writePortableRegistry({ version: "3.0", installations: [] });

		pinTestHome();
		await addPortableInstallation(
			"scout",
			"skill",
			"cursor",
			false,
			".cursor/skills/scout",
			".claude/skills/scout",
		);

		pinTestHome();
		const loaded = await readTestPortableRegistry();
		const entry = loaded.installations.find((i) => i.item === "scout");
		expect(entry).toBeDefined();
		expect(entry?.path).toBe(".cursor/skills/scout");
		expect(entry?.provider).toBe("cursor");
		expect(entry?.type).toBe("skill");
	});

	test("records windsurf skill at .windsurf/skills/<name> path (project scope)", async () => {
		pinTestHome();
		await writePortableRegistry({ version: "3.0", installations: [] });

		pinTestHome();
		await addPortableInstallation(
			"debug",
			"skill",
			"windsurf",
			false,
			".windsurf/skills/debug",
			".claude/skills/debug",
		);

		pinTestHome();
		const loaded = await readTestPortableRegistry();
		const entry = loaded.installations.find((i) => i.item === "debug");
		expect(entry).toBeDefined();
		expect(entry?.path).toBe(".windsurf/skills/debug");
		expect(entry?.provider).toBe("windsurf");
		expect(entry?.global).toBe(false);
	});

	test("records windsurf skill at ~/.codeium/windsurf/skills/<name> path (global scope)", async () => {
		pinTestHome();
		await writePortableRegistry({ version: "3.0", installations: [] });

		const globalPath = join(homedir(), ".codeium", "windsurf", "skills", "debug");
		pinTestHome();
		await addPortableInstallation(
			"debug",
			"skill",
			"windsurf",
			true,
			globalPath,
			".claude/skills/debug",
		);

		pinTestHome();
		const loaded = await readTestPortableRegistry();
		const entry = loaded.installations.find((i) => i.item === "debug" && i.global === true);
		expect(entry).toBeDefined();
		expect(entry?.path).toBe(globalPath);
		expect(entry?.global).toBe(true);
	});
});

describe("removePortableInstallation path guard", () => {
	test("does not remove a reinstalled identity when the stored path changed", async () => {
		await writePortableRegistry({
			version: "3.0",
			installations: [
				{
					item: "local",
					type: "command",
					provider: "codex",
					global: false,
					path: ".agents/skills/source-command-local/SKILL.md",
					installedAt: new Date().toISOString(),
					sourcePath: ".claude/commands/local.md",
					sourceChecksum: "new-source",
					targetChecksum: "new-target",
					installSource: "kit",
				},
			],
		});

		const removed = await removePortableInstallation("local", "command", "codex", false, {
			path: ".codex/prompts/local.md",
		});

		expect(removed).toBeNull();
		const loaded = await readPortableRegistry();
		expect(loaded.installations).toHaveLength(1);
		expect(loaded.installations[0]?.path).toBe(".agents/skills/source-command-local/SKILL.md");
	});

	test("removes the matching identity when the expected path matches", async () => {
		await writePortableRegistry({
			version: "3.0",
			installations: [
				{
					item: "local",
					type: "command",
					provider: "codex",
					global: false,
					path: ".codex/prompts/local.md",
					installedAt: new Date().toISOString(),
					sourcePath: ".claude/commands/local.md",
					sourceChecksum: "old-source",
					targetChecksum: "old-target",
					installSource: "kit",
				},
			],
		});

		const removed = await removePortableInstallation("local", "command", "codex", false, {
			path: ".codex/prompts/local.md",
		});

		expect(removed?.path).toBe(".codex/prompts/local.md");
		const loaded = await readPortableRegistry();
		expect(loaded.installations).toHaveLength(0);
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

		await writeFile(getRegistryPath(), JSON.stringify(v3Data, null, 2), "utf-8");

		// Should not throw parse error
		const loaded = await readPortableRegistry();
		expect(loaded.installations).toHaveLength(1);
	});
});
