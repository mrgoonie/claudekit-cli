import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import { SkillsMigrator } from "../../src/domains/skills/skills-migrator.js";
import type { MigrationOptions } from "../../src/types/index.js";

describe("SkillsMigrator", () => {
	let testDir: string;
	let newSkillsDir: string;
	let currentSkillsDir: string;

	beforeEach(async () => {
		// Create temp test directory
		const timestamp = Date.now();
		testDir = join(tmpdir(), `test-skills-migrator-${timestamp}`);
		newSkillsDir = join(testDir, "new");
		currentSkillsDir = join(testDir, "current");
		await mkdir(testDir, { recursive: true });
		await mkdir(currentSkillsDir, { recursive: true });
		await mkdir(newSkillsDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("migrate - no migration needed", () => {
		test("should succeed when no migration needed (same structure)", async () => {
			// Create flat structures in both
			await mkdir(join(newSkillsDir, "skill1"));
			await writeFile(join(newSkillsDir, "skill1", "skill.md"), "skill 1");
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "skill 1");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.migratedSkills).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});

		test("should succeed when no skills directories exist", async () => {
			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.migratedSkills).toHaveLength(0);
		});
	});

	describe("migrate - dry run mode", () => {
		test("should not make changes in dry run mode", async () => {
			// Current: flat
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision skill");

			// New: categorized
			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(
				join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"),
				"vision skill",
			);

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: true,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);

			// Verify no changes made
			expect(await pathExists(join(currentSkillsDir, "gemini-vision"))).toBe(true);
			expect(await pathExists(join(currentSkillsDir, "ai-multimodal"))).toBe(false);
		});
	});

	describe("migrate - non-interactive mode", () => {
		test("should migrate from flat to categorized structure", async () => {
			// Current: flat with known skills
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");
			await mkdir(join(currentSkillsDir, "docker"));
			await writeFile(join(currentSkillsDir, "docker", "skill.md"), "docker");

			// New: categorized
			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");
			await mkdir(join(newSkillsDir, "devops", "docker"), { recursive: true });
			await writeFile(join(newSkillsDir, "devops", "docker", "skill.md"), "docker");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.migratedSkills).toHaveLength(2);
			expect(result.migratedSkills).toContain("gemini-vision");
			expect(result.migratedSkills).toContain("docker");

			// Verify new structure
			expect(await pathExists(join(currentSkillsDir, "ai-multimodal", "gemini-vision"))).toBe(true);
			expect(await pathExists(join(currentSkillsDir, "devops", "docker"))).toBe(true);

			// Verify old flat structure removed
			expect(await pathExists(join(currentSkillsDir, "gemini-vision", "skill.md"))).toBe(false);
			expect(await pathExists(join(currentSkillsDir, "docker", "skill.md"))).toBe(false);
		});

		test("should preserve skill content during migration", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(
				join(currentSkillsDir, "gemini-vision", "skill.md"),
				"original vision content",
			);
			await writeFile(
				join(currentSkillsDir, "gemini-vision", "config.json"),
				'{"setting": "value"}',
			);

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "new");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			// Verify content preserved from current
			const content = await Bun.file(
				join(currentSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"),
			).text();
			expect(content).toBe("original vision content");

			const configContent = await Bun.file(
				join(currentSkillsDir, "ai-multimodal", "gemini-vision", "config.json"),
			).text();
			expect(configContent).toBe('{"setting": "value"}');
		});

		test("should handle nested file structures in skills", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision", "subdir"), { recursive: true });
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "main");
			await writeFile(join(currentSkillsDir, "gemini-vision", "subdir", "nested.md"), "nested");

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "new");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(
				await pathExists(
					join(currentSkillsDir, "ai-multimodal", "gemini-vision", "subdir", "nested.md"),
				),
			).toBe(true);

			const nestedContent = await Bun.file(
				join(currentSkillsDir, "ai-multimodal", "gemini-vision", "subdir", "nested.md"),
			).text();
			expect(nestedContent).toBe("nested");
		});

		test("should skip migration for unknown skills", async () => {
			// Current: flat with unknown skill
			await mkdir(join(currentSkillsDir, "unknown-skill"));
			await writeFile(join(currentSkillsDir, "unknown-skill", "skill.md"), "unknown");
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			// New: categorized
			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");
			await mkdir(join(newSkillsDir, "category", "unknown-skill"), { recursive: true });
			await writeFile(join(newSkillsDir, "category", "unknown-skill", "skill.md"), "unknown");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.migratedSkills).toHaveLength(1);
			expect(result.migratedSkills).toContain("gemini-vision");
			expect(result.migratedSkills).not.toContain("unknown-skill");
		});

		test("should migrate multiple skills in different categories", async () => {
			// Create multiple skills
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");
			await mkdir(join(currentSkillsDir, "docker"));
			await writeFile(join(currentSkillsDir, "docker", "skill.md"), "docker");
			await mkdir(join(currentSkillsDir, "nextjs"));
			await writeFile(join(currentSkillsDir, "nextjs", "skill.md"), "nextjs");
			await mkdir(join(currentSkillsDir, "tailwindcss"));
			await writeFile(join(currentSkillsDir, "tailwindcss", "skill.md"), "tailwind");

			// Create categorized new structure
			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");
			await mkdir(join(newSkillsDir, "devops", "docker"), { recursive: true });
			await writeFile(join(newSkillsDir, "devops", "docker", "skill.md"), "docker");
			await mkdir(join(newSkillsDir, "web-frameworks", "nextjs"), { recursive: true });
			await writeFile(join(newSkillsDir, "web-frameworks", "nextjs", "skill.md"), "nextjs");
			await mkdir(join(newSkillsDir, "ui-styling", "tailwindcss"), { recursive: true });
			await writeFile(join(newSkillsDir, "ui-styling", "tailwindcss", "skill.md"), "tailwind");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.migratedSkills).toHaveLength(4);

			// Verify all migrated to correct categories
			expect(await pathExists(join(currentSkillsDir, "ai-multimodal", "gemini-vision"))).toBe(true);
			expect(await pathExists(join(currentSkillsDir, "devops", "docker"))).toBe(true);
			expect(await pathExists(join(currentSkillsDir, "web-frameworks", "nextjs"))).toBe(true);
			expect(await pathExists(join(currentSkillsDir, "ui-styling", "tailwindcss"))).toBe(true);
		});
	});

	describe("migrate - backup functionality", () => {
		test("should create backup when requested", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: true,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.backupPath).toBeDefined();
			expect(result.backupPath).toContain(".skills-backup-");

			// Verify backup exists and contains original structure
			if (result.backupPath) {
				expect(await pathExists(result.backupPath)).toBe(true);
				expect(await pathExists(join(result.backupPath, "gemini-vision"))).toBe(true);
			}
		});

		test("should not create backup when not requested", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.backupPath).toBeUndefined();
		});

		test("should not create backup in dry run mode", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: true,
				dryRun: true,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.backupPath).toBeUndefined();
		});
	});

	describe("migrate - manifest generation", () => {
		test("should generate manifest after migration", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			// Verify manifest created
			const manifestPath = join(currentSkillsDir, ".skills-manifest.json");
			expect(await pathExists(manifestPath)).toBe(true);

			const manifestContent = await Bun.file(manifestPath).text();
			const manifest = JSON.parse(manifestContent);

			expect(manifest.structure).toBe("categorized");
			expect(manifest.skills).toHaveLength(1);
			expect(manifest.skills[0].name).toBe("gemini-vision");
			expect(manifest.skills[0].category).toBe("ai-multimodal");
		});

		test("should not generate manifest in dry run mode", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: true,
			};

			await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			const manifestPath = join(currentSkillsDir, ".skills-manifest.json");
			expect(await pathExists(manifestPath)).toBe(false);
		});
	});

	describe("migrate - edge cases", () => {
		test("should handle empty current skills directory", async () => {
			// Current dir already created in beforeEach
			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.migratedSkills).toHaveLength(0);
		});

		test("should skip hidden directories and node_modules", async () => {
			await mkdir(join(currentSkillsDir, ".hidden"));
			await writeFile(join(currentSkillsDir, ".hidden", "file.txt"), "hidden");
			await mkdir(join(currentSkillsDir, "node_modules"));
			await writeFile(join(currentSkillsDir, "node_modules", "file.txt"), "node");
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			const result = await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			expect(result.success).toBe(true);
			expect(result.migratedSkills).toHaveLength(1);
			expect(result.migratedSkills).toContain("gemini-vision");
		});

		test("should handle skills with binary files", async () => {
			await mkdir(join(currentSkillsDir, "gemini-vision"));
			await writeFile(join(currentSkillsDir, "gemini-vision", "skill.md"), "vision");
			await writeFile(
				join(currentSkillsDir, "gemini-vision", "image.png"),
				Buffer.from([0x89, 0x50, 0x4e, 0x47]),
			);

			await mkdir(join(newSkillsDir, "ai-multimodal", "gemini-vision"), { recursive: true });
			await writeFile(join(newSkillsDir, "ai-multimodal", "gemini-vision", "skill.md"), "vision");

			const options: MigrationOptions = {
				interactive: false,
				backup: false,
				dryRun: false,
			};

			await SkillsMigrator.migrate(newSkillsDir, currentSkillsDir, options);

			// Verify binary file migrated
			expect(
				await pathExists(join(currentSkillsDir, "ai-multimodal", "gemini-vision", "image.png")),
			).toBe(true);
		});
	});
});
