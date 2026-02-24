import { describe, expect, mock, test } from "bun:test";
import { migrateUserSkills } from "@/services/skill-migration-merger.js";

// Mock fs-extra
mock.module("fs-extra", () => ({
	pathExists: mock(() => Promise.resolve(true)),
}));

// Mock fs/promises
const mockReadFile = mock(() => Promise.resolve("{}"));
mock.module("node:fs/promises", () => ({
	readFile: mockReadFile,
}));

// Mock logger
mock.module("@/shared/logger.js", () => ({
	logger: {
		info: mock(() => {}),
		debug: mock(() => {}),
		verbose: mock(() => {}),
		warning: mock(() => {}),
		success: mock(() => {}),
	},
}));

describe("migrateUserSkills", () => {
	test("returns empty result when plugin not verified", async () => {
		const result = await migrateUserSkills("/fake/.claude", false);
		expect(result.preserved).toEqual([]);
		expect(result.deleted).toEqual([]);
		expect(result.userOwned).toEqual([]);
	});

	test("categorizes ck-owned skills as deleted", async () => {
		mockReadFile.mockResolvedValueOnce(
			JSON.stringify({
				kits: {
					engineer: {
						files: [
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
						],
					},
				},
			}),
		);

		const result = await migrateUserSkills("/fake/.claude", true);
		expect(result.deleted).toContain("skills/cook");
		expect(result.deleted).toContain("skills/debug");
		expect(result.preserved).toEqual([]);
		expect(result.userOwned).toEqual([]);
	});

	test("preserves ck-modified skills", async () => {
		mockReadFile.mockResolvedValueOnce(
			JSON.stringify({
				kits: {
					engineer: {
						files: [
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
						],
					},
				},
			}),
		);

		const result = await migrateUserSkills("/fake/.claude", true);
		expect(result.preserved).toContain("skills/cook");
		expect(result.deleted).toContain("skills/debug");
	});

	test("marks user-created skills as userOwned", async () => {
		mockReadFile.mockResolvedValueOnce(
			JSON.stringify({
				kits: {
					engineer: {
						files: [
							{
								path: "skills/my-custom/SKILL.md",
								checksum: "abc",
								ownership: "user",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			}),
		);

		const result = await migrateUserSkills("/fake/.claude", true);
		expect(result.userOwned).toContain("skills/my-custom");
		expect(result.deleted).toEqual([]);
		expect(result.preserved).toEqual([]);
	});

	test("ck-modified overrides ck for same skill dir", async () => {
		mockReadFile.mockResolvedValueOnce(
			JSON.stringify({
				kits: {
					engineer: {
						files: [
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
						],
					},
				},
			}),
		);

		const result = await migrateUserSkills("/fake/.claude", true);
		expect(result.preserved).toContain("skills/cook");
		expect(result.deleted).not.toContain("skills/cook");
	});

	test("returns empty when no tracked files", async () => {
		mockReadFile.mockResolvedValueOnce(
			JSON.stringify({
				kits: { engineer: { files: [] } },
			}),
		);

		const result = await migrateUserSkills("/fake/.claude", true);
		expect(result.preserved).toEqual([]);
		expect(result.deleted).toEqual([]);
		expect(result.userOwned).toEqual([]);
	});
});
