import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { PlansRegistry } from "@/domains/plan-parser/plan-types.js";
import {
	readRegistry,
	updateRegistryEntry,
	writeRegistry,
} from "@/domains/plan-parser/plans-registry.js";
import { PathResolver } from "@/shared/path-resolver.js";

let testRoot: string;

// --- Global registry relocation test state ---
let testHome: string;
const tempProjectDirs: string[] = [];

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "ck-plans-registry-"));
	mkdirSync(join(testRoot, ".claude"), { recursive: true });
	// Always set CK_TEST_HOME for global path isolation
	testHome = mkdtempSync(join(tmpdir(), "ck-plans-home-"));
	mkdirSync(join(testHome, ".claude"), { recursive: true });
	process.env.CK_TEST_HOME = testHome;
	tempProjectDirs.length = 0;
});

afterEach(() => {
	rmSync(testRoot, { recursive: true, force: true });
	// Clean up global relocation test state
	if (testHome) {
		rmSync(testHome, { recursive: true, force: true });
		testHome = "";
	}
	// Clean up per-test project dirs to prevent temp dir leaks
	for (const dir of tempProjectDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempProjectDirs.length = 0;
	Reflect.deleteProperty(process.env, "CK_TEST_HOME");
});

describe("plans-registry", () => {
	test("recovers with an empty registry when the file shape is invalid", () => {
		writeFileSync(
			join(testRoot, ".claude", "plans-registry.json"),
			JSON.stringify({ version: 1, plans: {}, stats: {} }),
			"utf8",
		);

		expect(readRegistry(testRoot)).toEqual({
			version: 1,
			plans: [],
			stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
		});
	});

	test("writes a backup and stores plan dirs relative to the project root", () => {
		writeRegistry(
			{
				version: 1,
				plans: [],
				stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
			},
			testRoot,
		);

		updateRegistryEntry(
			{
				dir: join(testRoot, "plans", "260412-demo"),
				title: "Demo Plan",
				status: "pending",
				created: "2026-04-12T00:00:00.000Z",
				createdBy: "ck-cli",
				source: "cli",
				phases: ["1", "2"],
				progressPct: 0,
			},
			testRoot,
		);

		const globalPath = PathResolver.getPlansRegistryPath(testRoot);
		const saved = readFileSync(globalPath, "utf8");
		expect(saved).toContain('"dir": "plans/260412-demo"');
		expect(existsSync(`${globalPath}.bak`)).toBe(true);
	});
});

// --- Helpers for global-registry-relocation tests ---

/**
 * Compute the expected project hash matching PathResolver.computeProjectHash (path-resolver.ts).
 * Must stay in sync with that private method — if the algorithm changes, update both.
 */
function computeExpectedHash(projectPath: string): string {
	let normalized = resolve(projectPath).replace(/[/\\]+$/, "");
	if (process.platform === "darwin" || process.platform === "win32") {
		normalized = normalized.toLowerCase();
	}
	return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

/** Create simulated project dir with .claude/ and .git/ markers. Auto-tracked for cleanup. */
function setupProjectDir(baseDir: string): string {
	mkdirSync(join(baseDir, ".claude"), { recursive: true });
	mkdirSync(join(baseDir, ".git"), { recursive: true });
	tempProjectDirs.push(baseDir);
	return baseDir;
}

/** Get the expected global registry file path for a given project cwd */
function getGlobalRegistryPath(cwd: string): string {
	const hash = computeExpectedHash(cwd);
	return join(PathResolver.getPlansRegistriesDir(), `${hash}.json`);
}

/** Old-style project-local registry path */
function getOldRegistryPath(projectDir: string): string {
	return join(projectDir, ".claude", "plans-registry.json");
}

describe("global-registry-relocation", () => {
	test("fresh install — no old registry reads from global path and returns empty", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));
		const result = readRegistry(projectDir);

		// Should return empty registry
		expect(result).toEqual({
			version: 1,
			plans: [],
			stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
		});

		// Global path should NOT have a file (empty means no file created)
		const globalPath = getGlobalRegistryPath(projectDir);
		expect(existsSync(globalPath)).toBe(false);

		// Old path should NOT exist either
		expect(existsSync(getOldRegistryPath(projectDir))).toBe(false);
	});

	test("existing old registry auto-migrates to global path", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		// Write old-style registry with plan data
		const oldData = {
			version: 1,
			plans: [
				{
					dir: "plans/demo",
					title: "Demo Plan",
					status: "pending",
					created: "2026-04-15T00:00:00.000Z",
					createdBy: "ck-cli",
					source: "cli",
					phases: ["1"],
					progressPct: 0,
				},
			],
			stats: { totalPlans: 1, completedPlans: 0, avgPhasesPerPlan: 1 },
		};
		writeFileSync(getOldRegistryPath(projectDir), JSON.stringify(oldData), "utf8");

		const result = readRegistry(projectDir);

		// Should return migrated data
		expect(result.plans).toHaveLength(1);
		expect(result.plans[0].title).toBe("Demo Plan");

		// Global path should now have the registry file
		const globalPath = getGlobalRegistryPath(projectDir);
		expect(existsSync(globalPath)).toBe(true);

		// Old file should be deleted after migration
		expect(existsSync(getOldRegistryPath(projectDir))).toBe(false);

		// Old .bak should also be deleted
		expect(existsSync(`${getOldRegistryPath(projectDir)}.bak`)).toBe(false);
	});

	test("corrupt old registry returns empty and preserves corrupt file for recovery", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		// Write invalid JSON to old path
		writeFileSync(getOldRegistryPath(projectDir), "{ invalid json !!!", "utf8");

		const result = readRegistry(projectDir);

		// Should recover with empty registry
		expect(result).toEqual({
			version: 1,
			plans: [],
			stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
		});

		// Corrupt old file should be PRESERVED for manual recovery (not deleted)
		expect(existsSync(getOldRegistryPath(projectDir))).toBe(true);
	});

	test("global already exists plus old exists prefers global and deletes old", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		// Pre-create global registry with existing data
		const globalDir = PathResolver.getPlansRegistriesDir();
		mkdirSync(globalDir, { recursive: true });
		const globalPath = getGlobalRegistryPath(projectDir);
		const globalData = {
			version: 1,
			plans: [
				{
					dir: "plans/global-plan",
					title: "Global Plan",
					status: "done",
					created: "2026-04-14T00:00:00.000Z",
					createdBy: "ck-cli",
					source: "cli",
					lastModified: "2026-04-14T00:00:00.000Z",
					phases: ["1", "2"],
					progressPct: 100,
				},
			],
			stats: { totalPlans: 1, completedPlans: 1, avgPhasesPerPlan: 2 },
		};
		writeFileSync(globalPath, JSON.stringify(globalData), "utf8");

		// Also create old registry (stale, from before migration)
		const oldData = {
			version: 1,
			plans: [
				{
					dir: "plans/old-plan",
					title: "Old Plan",
					status: "pending",
					created: "2026-04-13T00:00:00.000Z",
					createdBy: "ck-cli",
					source: "cli",
					phases: [],
					progressPct: 0,
				},
			],
			stats: { totalPlans: 1, completedPlans: 0, avgPhasesPerPlan: 0 },
		};
		writeFileSync(getOldRegistryPath(projectDir), JSON.stringify(oldData), "utf8");

		const result = readRegistry(projectDir);

		// Should prefer global data
		expect(result.plans).toHaveLength(1);
		expect(result.plans[0].title).toBe("Global Plan");

		// Old file should be deleted
		expect(existsSync(getOldRegistryPath(projectDir))).toBe(false);
	});

	test("write goes to global path not project dir", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		const registry: PlansRegistry = {
			version: 1,
			plans: [],
			stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
		};
		writeRegistry(registry, projectDir);

		// File should exist at global path
		const globalPath = getGlobalRegistryPath(projectDir);
		expect(existsSync(globalPath)).toBe(true);

		// File should NOT exist at old project-local path
		expect(existsSync(getOldRegistryPath(projectDir))).toBe(false);

		// Verify content is valid JSON
		const content = JSON.parse(readFileSync(globalPath, "utf8"));
		expect(content.version).toBe(1);
	});

	test("hash uniqueness — different project paths produce different hashes", () => {
		const projectA = mkdtempSync(join(tmpdir(), "ck-proj-a-"));
		const projectB = mkdtempSync(join(tmpdir(), "ck-proj-b-"));
		tempProjectDirs.push(projectA, projectB);

		const hashA = computeExpectedHash(projectA);
		const hashB = computeExpectedHash(projectB);

		expect(hashA).not.toBe(hashB);
	});

	test("hash stability — same path produces same hash on repeated calls", () => {
		const projectDir = mkdtempSync(join(tmpdir(), "ck-proj-"));
		tempProjectDirs.push(projectDir);

		const hash1 = computeExpectedHash(projectDir);
		const hash2 = computeExpectedHash(projectDir);

		expect(hash1).toBe(hash2);
	});

	test("case normalization — same hash on case-insensitive platforms (darwin/win32)", () => {
		const mixedCase = "/Users/Foo/project";
		const lowerCase = "/users/foo/project";

		const hashMixed = computeExpectedHash(mixedCase);
		const hashLower = computeExpectedHash(lowerCase);

		if (process.platform === "darwin" || process.platform === "win32") {
			// On macOS/Windows, both should produce same hash (case-insensitive FS)
			expect(hashMixed).toBe(hashLower);
		} else {
			// On Linux, case matters — hashes differ
			expect(hashMixed).not.toBe(hashLower);
		}
	});

	test("projectRoot field is included in written registry", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		writeRegistry(
			{
				version: 1,
				plans: [],
				stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
			},
			projectDir,
		);

		const globalPath = getGlobalRegistryPath(projectDir);
		const content = JSON.parse(readFileSync(globalPath, "utf8"));

		// Registry should contain projectRoot field
		expect(content.projectRoot).toBe(projectDir);
	});

	test("backup at global path — write then write creates .bak at global location", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		// First write
		writeRegistry(
			{
				version: 1,
				plans: [],
				stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
			},
			projectDir,
		);

		// Second write (triggers backup) — updateRegistryEntry handles missing fields
		updateRegistryEntry(
			{
				dir: join(projectDir, "plans", "test"),
				title: "Test",
				status: "pending",
				created: "2026-04-15T00:00:00.000Z",
				createdBy: "ck-cli",
				source: "cli",
				phases: [],
				progressPct: 0,
			},
			projectDir,
		);

		const globalPath = getGlobalRegistryPath(projectDir);
		const globalBakPath = `${globalPath}.bak`;

		// .bak should exist at global path
		expect(existsSync(globalBakPath)).toBe(true);

		// .bak should NOT exist at old project-local path
		expect(existsSync(`${getOldRegistryPath(projectDir)}.bak`)).toBe(false);
	});

	test("old .bak cleanup — migration deletes stale backup file", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		// Create old registry and its backup
		const oldData = {
			version: 1,
			plans: [],
			stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
		};
		writeFileSync(getOldRegistryPath(projectDir), JSON.stringify(oldData), "utf8");
		writeFileSync(`${getOldRegistryPath(projectDir)}.bak`, JSON.stringify(oldData), "utf8");

		readRegistry(projectDir);

		// Both old registry and old .bak should be deleted
		expect(existsSync(getOldRegistryPath(projectDir))).toBe(false);
		expect(existsSync(`${getOldRegistryPath(projectDir)}.bak`)).toBe(false);
	});

	test("CK_TEST_HOME override — global path derived from test home", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		// The registries dir should be under testHome
		const registriesDir = PathResolver.getPlansRegistriesDir();
		expect(registriesDir.startsWith(testHome)).toBe(true);
		expect(registriesDir).toContain("plans-registries");

		// Write and verify it lands under testHome
		writeRegistry(
			{
				version: 1,
				plans: [],
				stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
			},
			projectDir,
		);

		const globalPath = getGlobalRegistryPath(projectDir);
		expect(globalPath.startsWith(testHome)).toBe(true);
		expect(existsSync(globalPath)).toBe(true);
	});

	test("corrupt global file — returns empty registry without crashing", () => {
		const projectDir = setupProjectDir(mkdtempSync(join(tmpdir(), "ck-proj-")));

		// Pre-create corrupt global registry file
		const globalDir = PathResolver.getPlansRegistriesDir();
		mkdirSync(globalDir, { recursive: true });
		const globalPath = getGlobalRegistryPath(projectDir);
		writeFileSync(globalPath, "{ totally broken json !!!", "utf8");

		const result = readRegistry(projectDir);

		// Should recover with empty registry
		expect(result).toEqual({
			version: 1,
			plans: [],
			stats: { totalPlans: 0, completedPlans: 0, avgPhasesPerPlan: 0 },
		});
	});
});
