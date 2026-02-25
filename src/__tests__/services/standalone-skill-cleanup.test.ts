import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";

/**
 * Tests for standalone-skill-cleanup.ts
 *
 * Uses real filesystem with tmp dirs — no mocks.
 * We import the internal helpers by re-implementing the module structure
 * in temp directories and calling the exported function.
 */

// We need to mock PathResolver.getClaudeKitDir() to point to our temp dir
const originalEnv = { CK_TEST_HOME: process.env.CK_TEST_HOME };

interface TestDirs {
	claudeDir: string; // ~/.claude equivalent
	claudeKitDir: string; // ~/.claudekit equivalent
	pluginSkillsDir: string; // marketplace/plugins/ck/skills
	standaloneSkillsDir: string; // ~/.claude/skills
}

async function setupTestDirs(): Promise<TestDirs> {
	const base = await mkdtemp(join(tmpdir(), "ck-cleanup-test-"));
	const claudeDir = join(base, ".claude");
	const claudeKitDir = join(base, ".claudekit");
	const pluginSkillsDir = join(claudeKitDir, "marketplace", "plugins", "ck", "skills");
	const standaloneSkillsDir = join(claudeDir, "skills");

	await mkdir(pluginSkillsDir, { recursive: true });
	await mkdir(standaloneSkillsDir, { recursive: true });

	// Point PathResolver to our test dir
	process.env.CK_TEST_HOME = base;

	return { claudeDir, claudeKitDir, pluginSkillsDir, standaloneSkillsDir };
}

async function createSkillDir(baseDir: string, name: string): Promise<void> {
	const dir = join(baseDir, name);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "SKILL.md"), `# ${name}\nTest skill`);
}

async function writeMetadata(
	claudeDir: string,
	files: Array<{ path: string; ownership: string }>,
): Promise<void> {
	const metadata = {
		version: "3.0",
		files: files.map((f) => ({
			path: f.path,
			ownership: f.ownership,
			checksum: "abc123",
		})),
	};
	await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));
}

const tempBases: string[] = [];

describe("standalone-skill-cleanup", () => {
	let dirs: TestDirs;

	beforeEach(async () => {
		dirs = await setupTestDirs();
		tempBases.push(join(dirs.claudeDir, ".."));
	});

	afterEach(async () => {
		if (originalEnv.CK_TEST_HOME === undefined) {
			// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset (assignment coerces to string "undefined")
			delete process.env.CK_TEST_HOME;
		} else {
			process.env.CK_TEST_HOME = originalEnv.CK_TEST_HOME;
		}
		for (const d of tempBases) {
			await rm(d, { recursive: true, force: true }).catch(() => {});
		}
		tempBases.length = 0;
	});

	test("removes ck-owned standalone skills that overlap with plugin", async () => {
		// Create overlapping skill in both locations
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		// Track as ck-owned
		await writeMetadata(dirs.claudeDir, [{ path: "skills/brainstorm/SKILL.md", ownership: "ck" }]);

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		expect(result.removed).toContain("brainstorm");
		expect(result.preserved).toHaveLength(0);
		expect(await pathExists(join(dirs.standaloneSkillsDir, "brainstorm"))).toBe(false);
	});

	test("preserves user-owned standalone skills", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		await writeMetadata(dirs.claudeDir, [
			{ path: "skills/brainstorm/SKILL.md", ownership: "user" },
		]);

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		expect(result.removed).toHaveLength(0);
		expect(result.preserved).toContain("brainstorm");
		expect(await pathExists(join(dirs.standaloneSkillsDir, "brainstorm"))).toBe(true);
	});

	test("preserves ck-modified standalone skills", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "fix");
		await createSkillDir(dirs.standaloneSkillsDir, "fix");

		await writeMetadata(dirs.claudeDir, [
			{ path: "skills/fix/SKILL.md", ownership: "ck-modified" },
		]);

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		expect(result.removed).toHaveLength(0);
		expect(result.preserved).toContain("fix");
		expect(await pathExists(join(dirs.standaloneSkillsDir, "fix"))).toBe(true);
	});

	test("preserves untracked standalone skills (not in metadata)", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "unknown-skill");
		await createSkillDir(dirs.standaloneSkillsDir, "unknown-skill");

		// No metadata entry for this skill
		await writeMetadata(dirs.claudeDir, []);

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		expect(result.removed).toHaveLength(0);
		expect(result.preserved).toContain("unknown-skill");
		expect(await pathExists(join(dirs.standaloneSkillsDir, "unknown-skill"))).toBe(true);
	});

	test("skips non-overlapping skills", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "my-custom-skill");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		expect(result.removed).toHaveLength(0);
		expect(result.preserved).toHaveLength(0);
		// Custom skill untouched
		expect(await pathExists(join(dirs.standaloneSkillsDir, "my-custom-skill"))).toBe(true);
	});

	test("returns empty result when plugin dir is empty", async () => {
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		expect(result.removed).toHaveLength(0);
		expect(result.preserved).toHaveLength(0);
	});

	test("handles missing metadata gracefully", async () => {
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");
		// No metadata.json at all

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		// No metadata = untracked = preserved
		expect(result.removed).toHaveLength(0);
		expect(result.preserved).toContain("brainstorm");
	});

	test("handles mixed ownership across multiple skills", async () => {
		// Plugin has 3 skills
		await createSkillDir(dirs.pluginSkillsDir, "brainstorm");
		await createSkillDir(dirs.pluginSkillsDir, "fix");
		await createSkillDir(dirs.pluginSkillsDir, "cook");

		// Standalone has all 3
		await createSkillDir(dirs.standaloneSkillsDir, "brainstorm");
		await createSkillDir(dirs.standaloneSkillsDir, "fix");
		await createSkillDir(dirs.standaloneSkillsDir, "cook");

		await writeMetadata(dirs.claudeDir, [
			{ path: "skills/brainstorm/SKILL.md", ownership: "ck" },
			{ path: "skills/fix/SKILL.md", ownership: "user" },
			{ path: "skills/cook/SKILL.md", ownership: "ck" },
		]);

		const { cleanupOverlappingStandaloneSkills } = await import(
			"@/services/standalone-skill-cleanup.js"
		);
		const result = await cleanupOverlappingStandaloneSkills(dirs.claudeDir);

		expect(result.removed.sort()).toEqual(["brainstorm", "cook"]);
		expect(result.preserved).toContain("fix");
	});
});
