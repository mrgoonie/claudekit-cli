/**
 * Integration tests — windsurf + cursor migration path correctness
 *
 * Phase 05 deliverable: 6 tests across 3 scenarios × 2 providers.
 *
 * Scenarios:
 *   1. Fresh install — Cursor: skills land at .cursor/skills/<name>/SKILL.md
 *   2. Fresh install — Windsurf: skills land at .windsurf/skills/<name>/SKILL.md
 *   3. Upgrade-from-prior — Cursor: .agents/skills → .cursor/skills (old path cleaned)
 *   4. Upgrade-from-prior — Windsurf: .agents/skills → .windsurf/skills (old path cleaned)
 *   5. Idempotent rerun — Cursor: already native, registry @3.43.0 → plan all-skip
 *   6. Idempotent rerun — Windsurf: already native, registry @3.43.0 → plan all-skip
 *
 * Architecture:
 *   - Fresh/idempotent: call installSkillDirectories() with patched providers paths.
 *   - Upgrade: build ReconcileInput + call reconcile() to confirm delete actions,
 *     then verify installSkillDirectories() writes to native path.
 *   - Registry mock: intercept addPortableInstallation so no writes to ~/.claudekit.
 *   - No real HOME writes — provider paths are fully redirected to tmpdir.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Mock portable-registry before importing modules that use it
// ---------------------------------------------------------------------------
const addPortableInstallationMock = mock(async () => undefined);
const actualPortableRegistry = await import("../../portable/portable-registry.js");

mock.module("../../portable/portable-registry.js", () => ({
	...actualPortableRegistry,
	addPortableInstallation: addPortableInstallationMock,
}));

// Import after mock so skill-directory-installer picks up the mock
const { installSkillDirectories } = await import("../skill-directory-installer.js");

// Pure modules — no mock needed
const { reconcile } = await import("../../portable/reconciler.js");

// providers object is mutable — we patch paths to tmp dirs
const { providers } = await import("../../portable/provider-registry.js");

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------
const FIXTURES_DIR = join(import.meta.dir, "fixtures", "windsurf-cursor-upgrade");
const SKILL_FOO_SOURCE = join(FIXTURES_DIR, "skill-foo");
const MANIFEST_STUB_PATH = join(FIXTURES_DIR, "manifest-stub.json");

// ---------------------------------------------------------------------------
// Shared sandbox state
// ---------------------------------------------------------------------------
let sandboxRoot: string;

// Saved original provider skill path configs (restored in afterEach)
type SkillPathSave = {
	projectPath: string | null;
	globalPath: string | null;
};
let savedCursorSkills: SkillPathSave;
let savedWindsurfSkills: SkillPathSave;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh tmp sandbox for a test. Returns project + home dirs.
 */
function makeSandbox(label: string): { projectDir: string; homeDir: string } {
	const base = join(sandboxRoot, label);
	const projectDir = join(base, "project");
	const homeDir = join(base, "home");
	mkdirSync(projectDir, { recursive: true });
	mkdirSync(homeDir, { recursive: true });
	return { projectDir, homeDir };
}

/** Copy the skill-foo fixture into a source directory. */
async function copySkillFooToSource(sourceSkillsDir: string): Promise<void> {
	await mkdir(sourceSkillsDir, { recursive: true });
	await cp(SKILL_FOO_SOURCE, join(sourceSkillsDir, "skill-foo"), {
		recursive: true,
		force: true,
	});
}

/** Read manifest-stub.json fixture. */
function loadManifestStub() {
	return JSON.parse(readFileSync(MANIFEST_STUB_PATH, "utf-8"));
}

/** Minimal SkillInfo shape accepted by installSkillDirectories. */
function makeSkillInfo(name: string, sourcePath: string) {
	return { name, path: sourcePath, files: [] } as unknown as Parameters<
		typeof installSkillDirectories
	>[0][number];
}

/** Patch cursor provider's skill paths to use sandbox dirs. */
function patchCursorPaths(projectDir: string, homeDir: string) {
	savedCursorSkills = {
		projectPath: providers.cursor.skills?.projectPath ?? null,
		globalPath: providers.cursor.skills?.globalPath ?? null,
	};
	if (providers.cursor.skills) {
		providers.cursor.skills = {
			...providers.cursor.skills,
			projectPath: join(projectDir, ".cursor", "skills"),
			globalPath: join(homeDir, ".cursor", "skills"),
		};
	}
}

/** Patch windsurf provider's skill paths to use sandbox dirs. */
function patchWindsurfPaths(projectDir: string, homeDir: string) {
	savedWindsurfSkills = {
		projectPath: providers.windsurf.skills?.projectPath ?? null,
		globalPath: providers.windsurf.skills?.globalPath ?? null,
	};
	if (providers.windsurf.skills) {
		providers.windsurf.skills = {
			...providers.windsurf.skills,
			projectPath: join(projectDir, ".windsurf", "skills"),
			globalPath: join(homeDir, ".codeium", "windsurf", "skills"),
		};
	}
}

/** Restore cursor provider's skill paths. */
function restoreCursorPaths() {
	if (providers.cursor.skills && savedCursorSkills) {
		providers.cursor.skills = {
			...providers.cursor.skills,
			projectPath: savedCursorSkills.projectPath,
			globalPath: savedCursorSkills.globalPath,
		};
	}
}

/** Restore windsurf provider's skill paths. */
function restoreWindsurfPaths() {
	if (providers.windsurf.skills && savedWindsurfSkills) {
		providers.windsurf.skills = {
			...providers.windsurf.skills,
			projectPath: savedWindsurfSkills.projectPath,
			globalPath: savedWindsurfSkills.globalPath,
		};
	}
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(() => {
	sandboxRoot = join(tmpdir(), `ck-migration-integ-${Date.now()}`);
	mkdirSync(sandboxRoot, { recursive: true });
});

afterAll(() => {
	// Clean up ALL sandbox dirs created during the run
	try {
		rmSync(sandboxRoot, { recursive: true, force: true });
	} catch {
		// Best-effort cleanup
	}
	mock.restore();
});

beforeEach(() => {
	addPortableInstallationMock.mockClear();
	addPortableInstallationMock.mockImplementation(async () => undefined);
});

afterEach(() => {
	restoreCursorPaths();
	restoreWindsurfPaths();
});

// ---------------------------------------------------------------------------
// Test 1 — Fresh install, Cursor
// ---------------------------------------------------------------------------

describe("Fresh install — Cursor", () => {
	it("installs skill-foo at .cursor/skills/skill-foo/SKILL.md; .agents/skills does not exist", async () => {
		const { projectDir } = makeSandbox("fresh-cursor");

		// Source dir mimics a downloaded kit's .claude/skills/
		const sourceSkillsDir = join(projectDir, "kit-source", "skills");
		await copySkillFooToSource(sourceSkillsDir);

		// Patch cursor provider to use sandbox project dir
		patchCursorPaths(projectDir, join(projectDir, "fake-home"));

		const skill = makeSkillInfo("skill-foo", join(sourceSkillsDir, "skill-foo"));
		const results = await installSkillDirectories([skill], ["cursor"], { global: false });

		// Verify install result
		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(results[0].provider).toBe("cursor");

		// Verify native path exists
		const nativePath = join(projectDir, ".cursor", "skills", "skill-foo", "SKILL.md");
		expect(existsSync(nativePath)).toBe(true);

		// Verify .agents/skills was never created
		const agentsPath = join(projectDir, ".agents", "skills");
		expect(existsSync(agentsPath)).toBe(false);

		// Verify registry mock was called
		expect(addPortableInstallationMock).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Test 2 — Fresh install, Windsurf
// ---------------------------------------------------------------------------

describe("Fresh install — Windsurf", () => {
	it("installs skill-foo at .windsurf/skills/skill-foo/SKILL.md; .agents/skills does not exist", async () => {
		const { projectDir, homeDir } = makeSandbox("fresh-windsurf");

		const sourceSkillsDir = join(projectDir, "kit-source", "skills");
		await copySkillFooToSource(sourceSkillsDir);

		patchWindsurfPaths(projectDir, homeDir);

		const skill = makeSkillInfo("skill-foo", join(sourceSkillsDir, "skill-foo"));
		const results = await installSkillDirectories([skill], ["windsurf"], { global: false });

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(results[0].provider).toBe("windsurf");

		// Verify native project path
		const nativePath = join(projectDir, ".windsurf", "skills", "skill-foo", "SKILL.md");
		expect(existsSync(nativePath)).toBe(true);

		// .agents/skills must not exist
		const agentsPath = join(projectDir, ".agents", "skills");
		expect(existsSync(agentsPath)).toBe(false);

		expect(addPortableInstallationMock).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Test 3 — Upgrade from prior, Cursor
// ---------------------------------------------------------------------------

describe("Upgrade-from-prior — Cursor", () => {
	it("reconciler emits delete for .agents/skills; install goes to .cursor/skills", async () => {
		const { projectDir } = makeSandbox("upgrade-cursor");

		// Pre-seed old path: .agents/skills/skill-foo/SKILL.md
		const oldSkillDir = join(projectDir, ".agents", "skills", "skill-foo");
		mkdirSync(oldSkillDir, { recursive: true });
		writeFileSync(join(oldSkillDir, "SKILL.md"), "# Old skill-foo");

		// Build registry pointing to old path with appliedManifestVersion = 3.42.2
		const registry: import("../../portable/portable-registry.js").PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "skill-foo",
					type: "skill",
					provider: "cursor",
					global: false,
					path: oldSkillDir, // directory path (skills are dir-based)
					installedAt: "2025-01-01T00:00:00.000Z",
					sourcePath: ".claude/skills/skill-foo",
					sourceChecksum: "abc123",
					targetChecksum: "def456",
					installSource: "kit",
				},
			],
			appliedManifestVersion: "3.42.2",
		};

		const manifest = loadManifestStub();

		// Build reconcile input — path migration from .agents/skills → .cursor/skills
		const reconcileInput: import("../../portable/reconcile-types.js").ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest,
			providerConfigs: [{ provider: "cursor", global: false }],
		};

		const plan = reconcile(reconcileInput);

		// Reconciler should detect the path migration and produce a delete action
		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		expect(deleteActions.length).toBeGreaterThan(0);

		const pathMigratedDelete = deleteActions.find(
			(a) => a.item === "skill-foo" && a.provider === "cursor",
		);
		expect(pathMigratedDelete).toBeDefined();
		expect(pathMigratedDelete?.reasonCode).toBe("path-migrated-cleanup");
		expect(pathMigratedDelete?.previousPath).toBe(oldSkillDir);

		// Execute the delete action manually (simulates what migrate-command.ts does)
		if (existsSync(oldSkillDir)) {
			await rm(oldSkillDir, { recursive: true, force: true });
		}
		expect(existsSync(oldSkillDir)).toBe(false);

		// Now install to native cursor path
		patchCursorPaths(projectDir, join(projectDir, "fake-home"));
		const sourceSkillsDir = join(projectDir, "kit-source", "skills");
		await copySkillFooToSource(sourceSkillsDir);

		const skill = makeSkillInfo("skill-foo", join(sourceSkillsDir, "skill-foo"));
		const installResults = await installSkillDirectories([skill], ["cursor"], { global: false });

		expect(installResults[0].success).toBe(true);

		const nativePath = join(projectDir, ".cursor", "skills", "skill-foo", "SKILL.md");
		expect(existsSync(nativePath)).toBe(true);

		// Old .agents/skills still absent
		expect(existsSync(join(projectDir, ".agents", "skills", "skill-foo"))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Test 4 — Upgrade from prior, Windsurf
// ---------------------------------------------------------------------------

describe("Upgrade-from-prior — Windsurf", () => {
	it("reconciler emits delete for .agents/skills; install goes to .windsurf/skills", async () => {
		const { projectDir, homeDir } = makeSandbox("upgrade-windsurf");

		// Pre-seed old project path: .agents/skills/skill-foo/
		const oldProjectSkillDir = join(projectDir, ".agents", "skills", "skill-foo");
		mkdirSync(oldProjectSkillDir, { recursive: true });
		writeFileSync(join(oldProjectSkillDir, "SKILL.md"), "# Old skill-foo windsurf");

		const registry: import("../../portable/portable-registry.js").PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "skill-foo",
					type: "skill",
					provider: "windsurf",
					global: false,
					path: oldProjectSkillDir,
					installedAt: "2025-01-01T00:00:00.000Z",
					sourcePath: ".claude/skills/skill-foo",
					sourceChecksum: "abc123",
					targetChecksum: "def456",
					installSource: "kit",
				},
			],
			appliedManifestVersion: "3.42.2",
		};

		const manifest = loadManifestStub();

		const reconcileInput: import("../../portable/reconcile-types.js").ReconcileInput = {
			sourceItems: [],
			registry,
			targetStates: new Map(),
			manifest,
			providerConfigs: [{ provider: "windsurf", global: false }],
		};

		const plan = reconcile(reconcileInput);

		// Verify delete actions for windsurf old path
		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		expect(deleteActions.length).toBeGreaterThan(0);

		const pathMigratedDelete = deleteActions.find(
			(a) => a.item === "skill-foo" && a.provider === "windsurf",
		);
		expect(pathMigratedDelete).toBeDefined();
		expect(pathMigratedDelete?.reasonCode).toBe("path-migrated-cleanup");

		// Execute delete
		if (existsSync(oldProjectSkillDir)) {
			await rm(oldProjectSkillDir, { recursive: true, force: true });
		}
		expect(existsSync(oldProjectSkillDir)).toBe(false);

		// Install to native windsurf path
		patchWindsurfPaths(projectDir, homeDir);
		const sourceSkillsDir = join(projectDir, "kit-source", "skills");
		await copySkillFooToSource(sourceSkillsDir);

		const skill = makeSkillInfo("skill-foo", join(sourceSkillsDir, "skill-foo"));
		const installResults = await installSkillDirectories([skill], ["windsurf"], {
			global: false,
		});

		expect(installResults[0].success).toBe(true);

		const nativePath = join(projectDir, ".windsurf", "skills", "skill-foo", "SKILL.md");
		expect(existsSync(nativePath)).toBe(true);

		// Old path absent
		expect(existsSync(join(projectDir, ".agents", "skills", "skill-foo"))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Test 5 — Idempotent rerun, Cursor
// ---------------------------------------------------------------------------

describe("Idempotent rerun — Cursor", () => {
	it("reconcile plan all-skip when native path populated and registry at 3.43.0", async () => {
		const { projectDir } = makeSandbox("idempotent-cursor");

		// Pre-seed native cursor path
		const nativeSkillDir = join(projectDir, ".cursor", "skills", "skill-foo");
		mkdirSync(nativeSkillDir, { recursive: true });
		writeFileSync(join(nativeSkillDir, "SKILL.md"), "# skill-foo at native path");

		// Registry already up-to-date at 3.43.0, pointing to native path
		const registry: import("../../portable/portable-registry.js").PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "skill-foo",
					type: "skill",
					provider: "cursor",
					global: false,
					path: nativeSkillDir,
					installedAt: "2025-06-01T00:00:00.000Z",
					sourcePath: ".claude/skills/skill-foo",
					sourceChecksum: "abc123",
					targetChecksum: "abc123", // same — no drift
					installSource: "kit",
				},
			],
			appliedManifestVersion: "3.43.0",
		};

		const manifest = loadManifestStub();

		// Source item checksum matches registry — source unchanged
		const sourceItems: import("../../portable/reconcile-types.js").SourceItemState[] = [
			{
				item: "skill-foo",
				type: "skill",
				sourceChecksum: "abc123",
				convertedChecksums: { cursor: "abc123" },
			},
		];

		// Target state: native path exists with matching checksum
		const targetStates = new Map([
			[
				nativeSkillDir,
				{
					path: nativeSkillDir,
					exists: true,
					currentChecksum: "abc123",
				},
			],
		]);

		const reconcileInput: import("../../portable/reconcile-types.js").ReconcileInput = {
			sourceItems,
			registry,
			targetStates,
			manifest,
			providerConfigs: [{ provider: "cursor", global: false }],
		};

		const plan = reconcile(reconcileInput);

		// No delete actions from path migrations (registry already at 3.43.0 — no applicable entries)
		const deleteActions = plan.actions.filter((a) => a.action === "delete");
		const pathMigrationDeletes = deleteActions.filter(
			(a) => a.reasonCode === "path-migrated-cleanup",
		);
		expect(pathMigrationDeletes).toHaveLength(0);

		// All skills should be skipped (no writes, no deletes for skill-foo)
		const skillActions = plan.actions.filter(
			(a) => a.item === "skill-foo" && a.provider === "cursor",
		);
		for (const action of skillActions) {
			expect(action.action).toBe("skip");
		}

		// Verify native file is untouched
		const content = readFileSync(join(nativeSkillDir, "SKILL.md"), "utf-8");
		expect(content).toContain("native path");
	});
});

// ---------------------------------------------------------------------------
// Test 6 — Idempotent rerun, Windsurf
// ---------------------------------------------------------------------------

describe("Idempotent rerun — Windsurf", () => {
	it("reconcile plan all-skip when native path populated and registry at 3.43.0", async () => {
		const { projectDir } = makeSandbox("idempotent-windsurf");

		// Pre-seed native windsurf path
		const nativeSkillDir = join(projectDir, ".windsurf", "skills", "skill-foo");
		mkdirSync(nativeSkillDir, { recursive: true });
		writeFileSync(join(nativeSkillDir, "SKILL.md"), "# skill-foo at native windsurf path");

		const registry: import("../../portable/portable-registry.js").PortableRegistryV3 = {
			version: "3.0",
			installations: [
				{
					item: "skill-foo",
					type: "skill",
					provider: "windsurf",
					global: false,
					path: nativeSkillDir,
					installedAt: "2025-06-01T00:00:00.000Z",
					sourcePath: ".claude/skills/skill-foo",
					sourceChecksum: "abc123",
					targetChecksum: "abc123",
					installSource: "kit",
				},
			],
			appliedManifestVersion: "3.43.0",
		};

		const manifest = loadManifestStub();

		const sourceItems: import("../../portable/reconcile-types.js").SourceItemState[] = [
			{
				item: "skill-foo",
				type: "skill",
				sourceChecksum: "abc123",
				convertedChecksums: { windsurf: "abc123" },
			},
		];

		const targetStates = new Map([
			[
				nativeSkillDir,
				{
					path: nativeSkillDir,
					exists: true,
					currentChecksum: "abc123",
				},
			],
		]);

		const reconcileInput: import("../../portable/reconcile-types.js").ReconcileInput = {
			sourceItems,
			registry,
			targetStates,
			manifest,
			providerConfigs: [{ provider: "windsurf", global: false }],
		};

		const plan = reconcile(reconcileInput);

		// No path-migrated-cleanup deletes (already applied 3.43.0)
		const pathMigrationDeletes = plan.actions.filter(
			(a) => a.action === "delete" && a.reasonCode === "path-migrated-cleanup",
		);
		expect(pathMigrationDeletes).toHaveLength(0);

		// All windsurf skill actions should be skip
		const skillActions = plan.actions.filter(
			(a) => a.item === "skill-foo" && a.provider === "windsurf",
		);
		for (const action of skillActions) {
			expect(action.action).toBe("skip");
		}

		// File untouched
		const content = readFileSync(join(nativeSkillDir, "SKILL.md"), "utf-8");
		expect(content).toContain("native windsurf path");
	});
});
