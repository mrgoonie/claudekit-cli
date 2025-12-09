import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SkillsManifestManager } from "../../src/domains/skills/skills-manifest.js";
import type { SkillsManifest } from "../../src/types/index.js";
import { SkillsMigrationError } from "../../src/types/index.js";

describe("SkillsManifestManager", () => {
	let testDir: string;
	let skillsDir: string;

	beforeEach(async () => {
		// Create temp test directory
		const timestamp = Date.now();
		testDir = join(tmpdir(), `test-skills-manifest-${timestamp}`);
		skillsDir = join(testDir, "skills");
		await mkdir(skillsDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("generateManifest", () => {
		test("should generate manifest for flat structure", async () => {
			// Create flat structure: skills/skill1, skills/skill2
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "# Skill 1");
			await mkdir(join(skillsDir, "skill2"));
			await writeFile(join(skillsDir, "skill2", "skill.md"), "# Skill 2");

			const manifest = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest.version).toBe("1.0.0");
			expect(manifest.structure).toBe("flat");
			expect(manifest.skills).toHaveLength(2);
			expect(manifest.skills[0].name).toBe("skill1");
			expect(manifest.skills[1].name).toBe("skill2");
			expect(manifest.skills[0].hash).toBeDefined();
			expect(manifest.skills[0].category).toBeUndefined();
			expect(manifest.timestamp).toBeDefined();
		});

		test("should generate manifest for categorized structure", async () => {
			// Create categorized structure: skills/category1/skill1
			await mkdir(join(skillsDir, "category1", "skill1"), { recursive: true });
			await writeFile(join(skillsDir, "category1", "skill1", "skill.md"), "# Skill 1");
			await mkdir(join(skillsDir, "category2", "skill2"), { recursive: true });
			await writeFile(join(skillsDir, "category2", "skill2", "skill.md"), "# Skill 2");

			const manifest = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest.version).toBe("1.0.0");
			expect(manifest.structure).toBe("categorized");
			expect(manifest.skills).toHaveLength(2);
			expect(manifest.skills[0].name).toBe("skill1");
			expect(manifest.skills[0].category).toBe("category1");
			expect(manifest.skills[1].name).toBe("skill2");
			expect(manifest.skills[1].category).toBe("category2");
		});

		test("should generate manifest for empty directory", async () => {
			const manifest = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest.structure).toBe("flat");
			expect(manifest.skills).toHaveLength(0);
		});

		test("should throw error for non-existent directory", async () => {
			await expect(
				SkillsManifestManager.generateManifest(join(testDir, "nonexistent")),
			).rejects.toThrow(SkillsMigrationError);
		});

		test("should skip hidden directories and node_modules", async () => {
			await mkdir(join(skillsDir, ".hidden"));
			await writeFile(join(skillsDir, ".hidden", "file.txt"), "hidden");
			await mkdir(join(skillsDir, "node_modules"));
			await writeFile(join(skillsDir, "node_modules", "file.txt"), "node");
			await mkdir(join(skillsDir, "valid-skill"));
			await writeFile(join(skillsDir, "valid-skill", "skill.md"), "valid");

			const manifest = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest.skills).toHaveLength(1);
			expect(manifest.skills[0].name).toBe("valid-skill");
		});

		test("should generate different hashes for different content", async () => {
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "Content 1");
			await mkdir(join(skillsDir, "skill2"));
			await writeFile(join(skillsDir, "skill2", "skill.md"), "Content 2");

			const manifest = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest.skills[0].hash).not.toBe(manifest.skills[1].hash);
		});

		test("should generate same hash for identical content", async () => {
			// Create two skills with identical content
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "Identical Content");

			const manifest1 = await SkillsManifestManager.generateManifest(skillsDir);

			// Re-generate manifest
			const manifest2 = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest1.skills[0].hash).toBe(manifest2.skills[0].hash);
		});

		test("should sort skills alphabetically", async () => {
			await mkdir(join(skillsDir, "zebra"));
			await writeFile(join(skillsDir, "zebra", "skill.md"), "Z");
			await mkdir(join(skillsDir, "alpha"));
			await writeFile(join(skillsDir, "alpha", "skill.md"), "A");
			await mkdir(join(skillsDir, "beta"));
			await writeFile(join(skillsDir, "beta", "skill.md"), "B");

			const manifest = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest.skills[0].name).toBe("alpha");
			expect(manifest.skills[1].name).toBe("beta");
			expect(manifest.skills[2].name).toBe("zebra");
		});
	});

	describe("writeManifest", () => {
		test("should write manifest to disk", async () => {
			const manifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: new Date().toISOString(),
				skills: [
					{ name: "skill1", hash: "abc123" },
					{ name: "skill2", hash: "def456" },
				],
			};

			await SkillsManifestManager.writeManifest(skillsDir, manifest);

			const manifestPath = join(skillsDir, ".skills-manifest.json");
			const content = await Bun.file(manifestPath).text();
			const parsed = JSON.parse(content);

			expect(parsed.version).toBe("1.0.0");
			expect(parsed.structure).toBe("flat");
			expect(parsed.skills).toHaveLength(2);
		});

		test("should format manifest with proper JSON formatting", async () => {
			const manifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [{ name: "skill1", hash: "abc123" }],
			};

			await SkillsManifestManager.writeManifest(skillsDir, manifest);

			const manifestPath = join(skillsDir, ".skills-manifest.json");
			const content = await Bun.file(manifestPath).text();

			// Check it's formatted (has newlines and indentation)
			expect(content).toContain("\n");
			expect(content).toContain("  ");
		});
	});

	describe("readManifest", () => {
		test("should read valid manifest from disk", async () => {
			const manifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "abc123" },
					{ name: "skill2", hash: "def456" },
				],
			};

			await SkillsManifestManager.writeManifest(skillsDir, manifest);
			const read = await SkillsManifestManager.readManifest(skillsDir);

			expect(read).not.toBeNull();
			expect(read?.version).toBe("1.0.0");
			expect(read?.structure).toBe("flat");
			expect(read?.skills).toHaveLength(2);
		});

		test("should return null for non-existent manifest", async () => {
			const read = await SkillsManifestManager.readManifest(skillsDir);

			expect(read).toBeNull();
		});

		test("should return null for invalid JSON", async () => {
			const manifestPath = join(skillsDir, ".skills-manifest.json");
			await writeFile(manifestPath, "{ invalid json");

			const read = await SkillsManifestManager.readManifest(skillsDir);

			expect(read).toBeNull();
		});

		test("should return null for invalid schema", async () => {
			const manifestPath = join(skillsDir, ".skills-manifest.json");
			await writeFile(
				manifestPath,
				JSON.stringify({
					version: "1.0.0",
					// Missing required fields
				}),
			);

			const read = await SkillsManifestManager.readManifest(skillsDir);

			expect(read).toBeNull();
		});

		test("should validate categorized manifest", async () => {
			const manifest: SkillsManifest = {
				version: "1.0.0",
				structure: "categorized",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [{ name: "skill1", category: "category1", hash: "abc123" }],
			};

			await SkillsManifestManager.writeManifest(skillsDir, manifest);
			const read = await SkillsManifestManager.readManifest(skillsDir);

			expect(read).not.toBeNull();
			expect(read?.structure).toBe("categorized");
			expect(read?.skills[0].category).toBe("category1");
		});
	});

	describe("validateManifest", () => {
		test("should validate valid manifest", () => {
			const manifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [],
			};

			expect(SkillsManifestManager.validateManifest(manifest)).toBe(true);
		});

		test("should reject invalid manifest", () => {
			const invalid = {
				version: "1.0.0",
				// Missing required fields
			};

			expect(SkillsManifestManager.validateManifest(invalid)).toBe(false);
		});

		test("should reject manifest with invalid structure", () => {
			const invalid = {
				version: "1.0.0",
				structure: "invalid",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [],
			};

			expect(SkillsManifestManager.validateManifest(invalid)).toBe(false);
		});
	});

	describe("compareManifests", () => {
		test("should detect changed skills by hash", () => {
			const oldManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "abc123" },
					{ name: "skill2", hash: "def456" },
				],
			};

			const newManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-02T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "abc123" }, // Unchanged
					{ name: "skill2", hash: "xyz789" }, // Changed
				],
			};

			const changed = SkillsManifestManager.compareManifests(oldManifest, newManifest);

			expect(changed).toHaveLength(1);
			expect(changed[0]).toBe("skill2");
		});

		test("should return empty array when no changes", () => {
			const oldManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "abc123" },
					{ name: "skill2", hash: "def456" },
				],
			};

			const newManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-02T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "abc123" },
					{ name: "skill2", hash: "def456" },
				],
			};

			const changed = SkillsManifestManager.compareManifests(oldManifest, newManifest);

			expect(changed).toHaveLength(0);
		});

		test("should ignore new skills not in old manifest", () => {
			const oldManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [{ name: "skill1", hash: "abc123" }],
			};

			const newManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-02T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "abc123" },
					{ name: "skill2", hash: "def456" }, // New skill
				],
			};

			const changed = SkillsManifestManager.compareManifests(oldManifest, newManifest);

			expect(changed).toHaveLength(0);
		});

		test("should detect multiple changed skills", () => {
			const oldManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-01T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "abc123" },
					{ name: "skill2", hash: "def456" },
					{ name: "skill3", hash: "ghi789" },
				],
			};

			const newManifest: SkillsManifest = {
				version: "1.0.0",
				structure: "flat",
				timestamp: "2025-01-02T00:00:00.000Z",
				skills: [
					{ name: "skill1", hash: "changed1" }, // Changed
					{ name: "skill2", hash: "def456" }, // Unchanged
					{ name: "skill3", hash: "changed3" }, // Changed
				],
			};

			const changed = SkillsManifestManager.compareManifests(oldManifest, newManifest);

			expect(changed).toHaveLength(2);
			expect(changed).toContain("skill1");
			expect(changed).toContain("skill3");
		});
	});

	describe("integration tests", () => {
		test("should generate, write, and read manifest correctly", async () => {
			// Create skills
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "# Skill 1");
			await mkdir(join(skillsDir, "skill2"));
			await writeFile(join(skillsDir, "skill2", "skill.md"), "# Skill 2");

			// Generate and write
			const manifest = await SkillsManifestManager.generateManifest(skillsDir);
			await SkillsManifestManager.writeManifest(skillsDir, manifest);

			// Read back
			const read = await SkillsManifestManager.readManifest(skillsDir);

			expect(read).not.toBeNull();
			expect(read?.skills).toHaveLength(2);
			expect(read?.skills[0].hash).toBe(manifest.skills[0].hash);
		});

		test("should detect changes after file modification", async () => {
			// Create initial skill
			await mkdir(join(skillsDir, "skill1"));
			await writeFile(join(skillsDir, "skill1", "skill.md"), "Original content");

			const manifest1 = await SkillsManifestManager.generateManifest(skillsDir);

			// Modify skill
			await writeFile(join(skillsDir, "skill1", "skill.md"), "Modified content");

			const manifest2 = await SkillsManifestManager.generateManifest(skillsDir);

			const changed = SkillsManifestManager.compareManifests(manifest1, manifest2);

			expect(changed).toHaveLength(1);
			expect(changed[0]).toBe("skill1");
		});

		test("should handle nested file structure in skills", async () => {
			// Create skill with nested files
			await mkdir(join(skillsDir, "skill1", "subdir"), { recursive: true });
			await writeFile(join(skillsDir, "skill1", "skill.md"), "Main file");
			await writeFile(join(skillsDir, "skill1", "subdir", "nested.md"), "Nested file");

			const manifest = await SkillsManifestManager.generateManifest(skillsDir);

			expect(manifest.skills).toHaveLength(1);
			expect(manifest.skills[0].hash).toBeDefined();

			// Modify nested file
			await writeFile(join(skillsDir, "skill1", "subdir", "nested.md"), "Modified nested");

			const manifest2 = await SkillsManifestManager.generateManifest(skillsDir);

			// Hash should change
			expect(manifest2.skills[0].hash).not.toBe(manifest.skills[0].hash);
		});
	});
});
