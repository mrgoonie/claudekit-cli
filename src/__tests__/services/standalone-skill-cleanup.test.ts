import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";

/**
 * Tests for standalone-skill-cleanup.ts (backup-then-remove strategy).
 * Uses real filesystem with tmp dirs.
 */

interface TestDirs {
	claudeDir: string;
	pluginSkillsDir: string;
	standaloneSkillsDir: string;
	backupDir: string;
}

async function setupTestDirs(): Promise<TestDirs> {
	const base = await mkdtemp(join(tmpdir(), "ck-cleanup-test-"));
	const claudeDir = join(base, ".claude");
	const pluginSkillsDir = join(base, ".claudekit", "marketplace", "plugins", "ck", "skills");
	const standaloneSkillsDir = join(claudeDir, "skills");
	const backupDir = join(standaloneSkillsDir, ".backup");

	await mkdir(pluginSkillsDir, { recursive: true });
	await mkdir(standaloneSkillsDir, { recursive: true });

	return { claudeDir, pluginSkillsDir, standaloneSkillsDir, backupDir };
}

async function createSkillDir(baseDir: string, name: string): Promise<void> {
	const dir = join(baseDir, name);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "SKILL.md"), `# ${name}\nTest skill`);
}

const tempBases: string[] = [];

describe("standalone-skill-cleanup", () => {
	let dirs: TestDirs;

	beforeEach(async () => {
		dirs = await setupTestDirs();
		tempBases.push(join(dirs.claudeDir, ".."));
	});

	afterEach(async () => {
		for (const d of tempBases) {
			await rm(d, { recursive: true, force: true }).catch(() => {});
		}
		tempBases.length = 0;
	});

	test("backs up and removes overlapping standalone skill", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);

		expect(result.removed).toContain("brainstorm");
		expect(await pathExists(join(dirs.standaloneSkillsDir, "brainstorm"))).toBe(false);
		expect(await pathExists(join(dirs.backupDir, "brainstorm", "SKILL.md"))).toBe(true);
	});

	test("removes regardless of ownership (user, ck, ck-modified all removed)", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "debug");
		await createSkillDir(dirs.standaloneSkillsDir, "debug");
		// Even with user-owned references, standalone gets backed up + removed
		await mkdir(join(dirs.standaloneSkillsDir, "debug", "references"), { recursive: true });
		await writeFile(
			join(dirs.standaloneSkillsDir, "debug", "references", "custom.md"),
			"user content",
		);

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);

		expect(result.removed).toContain("debug");
		expect(await pathExists(join(dirs.standaloneSkillsDir, "debug"))).toBe(false);
		// Backup preserves user content
		expect(await pathExists(join(dirs.backupDir, "debug", "references", "custom.md"))).toBe(true);
	});

	test("idempotent: second run is a no-op (standalone already gone)", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);

		// First run: backs up and removes
		const r1 = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);
		expect(r1.removed).toContain("brainstorm");

		// Second run: standalone gone, no overlap detected = nothing to do
		const r2 = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);
		expect(r2.removed).toHaveLength(0);
		expect(r2.skipped).toHaveLength(0);
		// Backup still intact from first run
		expect(await pathExists(join(dirs.backupDir, "brainstorm", "SKILL.md"))).toBe(true);
	});

	test("idempotent: cleans residual standalone if backup exists but standalone reappears", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);

		// First run: backs up and removes
		await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);

		// Simulate skill reappearing (e.g., user re-ran old installer)
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		// Second run: removes residual without overwriting backup
		const r2 = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);
		expect(r2.removed).toContain("brainstorm");
		expect(await pathExists(join(dirs.standaloneSkillsDir, "brainstorm"))).toBe(false);
		// Original backup still intact
		expect(await pathExists(join(dirs.backupDir, "brainstorm", "SKILL.md"))).toBe(true);
	});

	test("skips non-overlapping standalone skills", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "my-custom-skill");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);

		expect(result.removed).toHaveLength(0);
		expect(result.skipped).toHaveLength(0);
		expect(await pathExists(join(dirs.standaloneSkillsDir, "my-custom-skill"))).toBe(true);
	});

	test("returns empty result when plugin dir is empty", async () => {
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);

		expect(result.removed).toHaveLength(0);
		expect(result.skipped).toHaveLength(0);
	});

	test("handles multiple overlapping skills in one run", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.pluginSkillsDir, "debug");
		await createSkillDir(dirs.pluginSkillsDir, "cook");

		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "debug");
		await createSkillDir(dirs.standaloneSkillsDir, "cook");
		await createSkillDir(dirs.standaloneSkillsDir, "my-custom"); // non-overlapping

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);

		expect(result.removed.sort()).toEqual(["brainstorm", "cook", "debug"]);
		expect(await pathExists(join(dirs.standaloneSkillsDir, "my-custom"))).toBe(true);
		// All three backed up
		expect(await pathExists(join(dirs.backupDir, "brainstorm"))).toBe(true);
		expect(await pathExists(join(dirs.backupDir, "debug"))).toBe(true);
		expect(await pathExists(join(dirs.backupDir, "cook"))).toBe(true);
	});

	test("does not treat .backup dir as a skill", async () => {
		await createSkillDir(dirs.pluginSkillsDir, ".backup");
		await mkdir(dirs.backupDir, { recursive: true });
		await writeFile(join(dirs.backupDir, "SKILL.md"), "not a skill");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir, dirs.pluginSkillsDir);

		// .backup excluded from scan
		expect(result.removed).toHaveLength(0);
	});
});
