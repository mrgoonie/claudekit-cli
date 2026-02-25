import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateUserSkills } from "@/services/skill-migration-merger.js";
import type { TrackedFile } from "@/types/metadata.js";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function createClaudeDirWithFiles(files: TrackedFile[]): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ck-skill-migration-"));
	tempDirs.push(dir);
	const metadataPath = join(dir, "metadata.json");
	const metadata = {
		kits: {
			engineer: {
				files,
			},
		},
	};
	await writeFile(metadataPath, JSON.stringify(metadata), "utf-8");
	return dir;
}

describe("migrateUserSkills", () => {
	test("returns empty result when plugin not verified", async () => {
		const result = await migrateUserSkills("/does/not/matter", false);
		expect(result.preserved).toEqual([]);
		expect(result.deleted).toEqual([]);
		expect(result.userOwned).toEqual([]);
		expect(result.canDelete).toBe(false);
	});

	test("categorizes ck-owned skills as deleted", async () => {
		const dir = await createClaudeDirWithFiles([
			{
				path: "skills/cook/SKILL.md",
				checksum: "abc",
				ownership: "ck",
				installedVersion: "1.0.0",
			},
			{
				path: "skills/cook/references/a.md",
				checksum: "def",
				ownership: "ck",
				installedVersion: "1.0.0",
			},
			{
				path: "skills/debug/SKILL.md",
				checksum: "ghi",
				ownership: "ck",
				installedVersion: "1.0.0",
			},
		]);

		const result = await migrateUserSkills(dir, true);
		expect(result.deleted).toContain("skills/cook");
		expect(result.deleted).toContain("skills/debug");
		expect(result.preserved).toEqual([]);
		expect(result.userOwned).toEqual([]);
		expect(result.canDelete).toBe(true);
	});

	test("preserves ck-modified skills", async () => {
		const dir = await createClaudeDirWithFiles([
			{
				path: "skills/cook/SKILL.md",
				checksum: "abc",
				ownership: "ck-modified",
				installedVersion: "1.0.0",
			},
			{
				path: "skills/debug/SKILL.md",
				checksum: "def",
				ownership: "ck",
				installedVersion: "1.0.0",
			},
		]);

		const result = await migrateUserSkills(dir, true);
		expect(result.preserved).toContain("skills/cook");
		expect(result.deleted).toContain("skills/debug");
		expect(result.canDelete).toBe(true);
	});

	test("marks user-created skills as userOwned", async () => {
		const dir = await createClaudeDirWithFiles([
			{
				path: "skills/my-custom/SKILL.md",
				checksum: "abc",
				ownership: "user",
				installedVersion: "1.0.0",
			},
		]);

		const result = await migrateUserSkills(dir, true);
		expect(result.userOwned).toContain("skills/my-custom");
		expect(result.deleted).toEqual([]);
		expect(result.preserved).toEqual([]);
		expect(result.canDelete).toBe(true);
	});

	test("ck-modified overrides ck for same skill dir", async () => {
		const dir = await createClaudeDirWithFiles([
			{
				path: "skills/cook/SKILL.md",
				checksum: "abc",
				ownership: "ck-modified",
				installedVersion: "1.0.0",
			},
			{
				path: "skills/cook/references/a.md",
				checksum: "def",
				ownership: "ck",
				installedVersion: "1.0.0",
			},
		]);

		const result = await migrateUserSkills(dir, true);
		expect(result.preserved).toContain("skills/cook");
		expect(result.deleted).not.toContain("skills/cook");
		expect(result.canDelete).toBe(true);
	});

	test("returns empty when no tracked files", async () => {
		const dir = await createClaudeDirWithFiles([]);
		const result = await migrateUserSkills(dir, true);

		expect(result.preserved).toEqual([]);
		expect(result.deleted).toEqual([]);
		expect(result.userOwned).toEqual([]);
		expect(result.canDelete).toBe(false);
	});

	test("returns fail-safe when metadata is invalid JSON", async () => {
		const dir = await mkdtemp(join(tmpdir(), "ck-skill-migration-invalid-"));
		tempDirs.push(dir);
		await writeFile(join(dir, "metadata.json"), "{invalid", "utf-8");

		const result = await migrateUserSkills(dir, true);
		expect(result.preserved).toEqual([]);
		expect(result.deleted).toEqual([]);
		expect(result.userOwned).toEqual([]);
		expect(result.canDelete).toBe(false);
	});
});
