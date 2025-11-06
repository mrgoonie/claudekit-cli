import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SkillsMigrationDetector } from "../../src/lib/skills-detector.js";
import { SkillsManifestManager } from "../../src/lib/skills-manifest.js";

describe("SkillsMigrationDetector", () => {
	let testDir: string;
	let oldSkillsDir: string;
	let currentSkillsDir: string;

	beforeEach(async () => {
		// Create temp test directory
		const timestamp = Date.now();
		testDir = join(tmpdir(), `test-skills-detector-${timestamp}`);
		oldSkillsDir = join(testDir, "old-skills");
		currentSkillsDir = join(testDir, "current-skills");
		await mkdir(testDir, { recursive: true });
		await mkdir(oldSkillsDir, { recursive: true });
		await mkdir(currentSkillsDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("detectMigration - basic scenarios", () => {
		test("should return not_needed when empty directories exist", async () => {
			// Directories are created in beforeEach but are empty
			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("not_needed");
			// Empty directories are detected as flat structure
			expect(result.oldStructure).toBe("flat");
			expect(result.newStructure).toBe("flat");
			expect(result.skillMappings).toHaveLength(0);
		});

		test("should return not_needed when only new directory exists", async () => {
			await mkdir(oldSkillsDir, { recursive: true });

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("not_needed");
		});

		test("should return not_needed for same flat structure", async () => {
			// Create flat structures in both
			await mkdir(join(oldSkillsDir, "skill1"));
			await writeFile(join(oldSkillsDir, "skill1", "skill.md"), "skill 1");
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "skill 1");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("not_needed");
			expect(result.oldStructure).toBe("flat");
			expect(result.newStructure).toBe("flat");
		});

		test("should return not_needed for same categorized structure", async () => {
			// Create categorized structures in both
			await mkdir(join(oldSkillsDir, "category1", "skill1"), { recursive: true });
			await writeFile(join(oldSkillsDir, "category1", "skill1", "skill.md"), "skill 1");
			await mkdir(join(currentSkillsDir, "category1", "skill1"), { recursive: true });
			await writeFile(join(currentSkillsDir, "category1", "skill1", "skill.md"), "skill 1");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("not_needed");
			expect(result.oldStructure).toBe("categorized");
			expect(result.newStructure).toBe("categorized");
		});
	});

	describe("detectMigration - migration needed scenarios", () => {
		test("should detect migration from flat to categorized", async () => {
			// Current: flat
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision skill");

			// New: categorized
			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(
				join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"),
				"vision skill",
			);

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("recommended");
			expect(result.oldStructure).toBe("flat");
			expect(result.newStructure).toBe("categorized");
			expect(result.skillMappings.length).toBeGreaterThan(0);
		});

		test("should generate skill mappings for migratable skills", async () => {
			// Current: flat with known migratable skills
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");
			await mkdir(join(currentSkillsDir, "docker"));
			await writeFile(join(currentSkillsDir, "docker", "skill.md"), "docker");

			// New: categorized
			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");
			await mkdir(join(oldSkillsDir, "devops", "docker"), { recursive: true });
			await writeFile(join(oldSkillsDir, "devops", "docker", "skill.md"), "docker");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("recommended");
			expect(result.skillMappings).toHaveLength(2);

			const visionMapping = result.skillMappings.find((m) => m.skillName === "gemini-vision");
			expect(visionMapping).toBeDefined();
			expect(visionMapping?.category).toBe("ai-multimodal");

			const dockerMapping = result.skillMappings.find((m) => m.skillName === "docker");
			expect(dockerMapping).toBeDefined();
			expect(dockerMapping?.category).toBe("devops");
		});

		test("should not suggest migration for preserved skills only", async () => {
			// Current: flat with only preserved skills
			await mkdir(join(currentSkillsDir, "common"));
			await writeFile(join(currentSkillsDir, "common", "skill.md"), "common");
			await mkdir(join(currentSkillsDir, "debugging"));
			await writeFile(join(currentSkillsDir, "debugging", "skill.md"), "debug");

			// New: same flat structure
			await mkdir(join(oldSkillsDir, "common"));
			await writeFile(join(oldSkillsDir, "common", "skill.md"), "common");
			await mkdir(join(oldSkillsDir, "debugging"));
			await writeFile(join(oldSkillsDir, "debugging", "skill.md"), "debug");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("not_needed");
			expect(result.skillMappings).toHaveLength(0);
		});
	});

	describe("detectMigration - manifest-based detection", () => {
		test("should use manifest for detection when available", async () => {
			// Create flat current structure
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			// Create categorized new structure
			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			// Generate manifests
			const currentManifest = await SkillsManifestManager.generateManifest(currentSkillsDir);
			await SkillsManifestManager.writeManifest(currentSkillsDir, currentManifest);

			const newManifest = await SkillsManifestManager.generateManifest(oldSkillsDir);
			await SkillsManifestManager.writeManifest(oldSkillsDir, newManifest);

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("recommended");
			expect(result.oldStructure).toBe("flat");
			expect(result.newStructure).toBe("categorized");
		});

		test("should fallback to heuristics when no new manifest", async () => {
			// Create flat current structure with manifest
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");
			const currentManifest = await SkillsManifestManager.generateManifest(currentSkillsDir);
			await SkillsManifestManager.writeManifest(currentSkillsDir, currentManifest);

			// Create categorized new structure WITHOUT manifest
			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("recommended");
		});

		test("should generate current manifest when missing", async () => {
			// Create flat current structure WITHOUT manifest
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			// Create categorized new structure WITH manifest
			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");
			const newManifest = await SkillsManifestManager.generateManifest(oldSkillsDir);
			await SkillsManifestManager.writeManifest(oldSkillsDir, newManifest);

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("recommended");
			expect(result.oldStructure).toBe("flat");
			expect(result.newStructure).toBe("categorized");
		});
	});

	describe("detectMigration - heuristic detection", () => {
		test("should detect flat structure by file patterns", async () => {
			// Flat: skills directly in directory
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "readme.md"), "skill 1");
			await mkdir(join(currentSkillsDir, "skill2"));
			await writeFile(join(currentSkillsDir, "skill2", "readme.md"), "skill 2");

			await mkdir(join(oldSkillsDir, "skill1"));
			await writeFile(join(oldSkillsDir, "skill1", "readme.md"), "skill 1");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.oldStructure).toBe("flat");
			expect(result.newStructure).toBe("flat");
		});

		test("should detect categorized structure by subdirectories", async () => {
			// Categorized: categories containing skills
			await mkdir(join(currentSkillsDir, "category1", "skill1"), { recursive: true });
			await writeFile(join(currentSkillsDir, "category1", "skill1", "skill.md"), "skill");

			await mkdir(join(oldSkillsDir, "category1", "skill1"), { recursive: true });
			await writeFile(join(oldSkillsDir, "category1", "skill1", "skill.md"), "skill");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.oldStructure).toBe("categorized");
			expect(result.newStructure).toBe("categorized");
		});

		test("should skip hidden directories and node_modules", async () => {
			await mkdir(join(currentSkillsDir, ".hidden"));
			await writeFile(join(currentSkillsDir, ".hidden", "file.txt"), "hidden");
			await mkdir(join(currentSkillsDir, "node_modules"));
			await writeFile(join(currentSkillsDir, "node_modules", "file.txt"), "node");
			await mkdir(join(currentSkillsDir, "valid-skill"));
			await writeFile(join(currentSkillsDir, "valid-skill", "skill.md"), "valid");

			await mkdir(join(oldSkillsDir, "valid-skill"));
			await writeFile(join(oldSkillsDir, "valid-skill", "skill.md"), "valid");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.oldStructure).toBe("flat");
			expect(result.newStructure).toBe("flat");
		});
	});

	describe("detectMigration - skill mapping generation", () => {
		test("should generate correct paths in mappings", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.skillMappings.length).toBeGreaterThan(0);

			const mapping = result.skillMappings[0];
			expect(mapping.oldPath).toContain("gemini-vision");
			expect(mapping.newPath).toContain("ai-multimodal");
			expect(mapping.newPath).toContain("gemini-vision");
			expect(mapping.skillName).toBe("gemini-vision");
			expect(mapping.category).toBe("ai-multimodal");
		});

		test("should handle multiple skills in different categories", async () => {
			// Create multiple migratable skills
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");
			await mkdir(join(currentSkillsDir, "docker"));
			await writeFile(join(currentSkillsDir, "docker", "skill.md"), "docker");
			await mkdir(join(currentSkillsDir, "nextjs"));
			await writeFile(join(currentSkillsDir, "nextjs", "skill.md"), "nextjs");

			// Create categorized new structure
			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");
			await mkdir(join(oldSkillsDir, "devops", "docker"), { recursive: true });
			await writeFile(join(oldSkillsDir, "devops", "docker", "skill.md"), "docker");
			await mkdir(join(oldSkillsDir, "web-frameworks", "nextjs"), { recursive: true });
			await writeFile(join(oldSkillsDir, "web-frameworks", "nextjs", "skill.md"), "nextjs");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.skillMappings).toHaveLength(3);

			const categories = result.skillMappings.map((m) => m.category);
			expect(categories).toContain("ai-multimodal");
			expect(categories).toContain("devops");
			expect(categories).toContain("web-frameworks");
		});

		test("should not generate mappings for unknown skills", async () => {
			await mkdir(join(currentSkillsDir, "unknown-skill"));
			await writeFile(join(currentSkillsDir, "unknown-skill", "skill.md"), "unknown");

			await mkdir(join(oldSkillsDir, "category", "unknown-skill"), { recursive: true });
			await writeFile(join(oldSkillsDir, "category", "unknown-skill", "skill.md"), "unknown");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			// Should detect categorized structure but no mappings for unknown skill
			expect(result.newStructure).toBe("categorized");
			expect(result.skillMappings).toHaveLength(0);
		});
	});

	describe("detectMigration - edge cases", () => {
		test("should handle empty skills directories", async () => {
			await mkdir(oldSkillsDir, { recursive: true });
			await mkdir(currentSkillsDir, { recursive: true });

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("not_needed");
		});

		test("should handle mixed preserved and migratable skills", async () => {
			// Mix of preserved (common) and migratable (docker) skills
			await mkdir(join(currentSkillsDir, "common"));
			await writeFile(join(currentSkillsDir, "common", "skill.md"), "common");
			await mkdir(join(currentSkillsDir, "docker"));
			await writeFile(join(currentSkillsDir, "docker", "skill.md"), "docker");

			await mkdir(join(oldSkillsDir, "common"));
			await writeFile(join(oldSkillsDir, "common", "skill.md"), "common");
			await mkdir(join(oldSkillsDir, "devops", "docker"), { recursive: true });
			await writeFile(join(oldSkillsDir, "devops", "docker", "skill.md"), "docker");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("recommended");
			expect(result.skillMappings).toHaveLength(1);
			expect(result.skillMappings[0].skillName).toBe("docker");
		});

		test("should handle skills with multiple files", async () => {
			// Skill with multiple files
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "main");
			await writeFile(join(currentSkillsDir, "gemini-vision", "config.json"), "{}");
			await writeFile(join(currentSkillsDir, "gemini-vision", "helper.js"), "code");

			await mkdir(join(oldSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(oldSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "main");

			const result = await SkillsMigrationDetector.detectMigration(oldSkillsDir, currentSkillsDir);

			expect(result.status).toBe("recommended");
			expect(result.skillMappings).toHaveLength(1);
		});
	});
});
