import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SkillsCustomizationScanner } from "../../src/lib/skills-customization-scanner.js";
import { SkillsManifestManager } from "../../src/lib/skills-manifest.js";

describe("SkillsCustomizationScanner", () => {
	let testDir: string;
	let currentSkillsDir: string;
	let baselineSkillsDir: string;

	beforeEach(async () => {
		// Create temp test directory
		const timestamp = Date.now();
		testDir = join(tmpdir(), `test-skills-customization-${timestamp}`);
		currentSkillsDir = join(testDir, "current");
		baselineSkillsDir = join(testDir, "baseline");
		await mkdir(testDir, { recursive: true });
		await mkdir(currentSkillsDir, { recursive: true });
		await mkdir(baselineSkillsDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup
		if (testDir) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("scanCustomizations - without baseline", () => {
		test("should return non-customized for all skills when no baseline", async () => {
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "content");
			await mkdir(join(currentSkillsDir, "skill2"));
			await writeFile(join(currentSkillsDir, "skill2", "skill.md"), "content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(currentSkillsDir);

			expect(customizations).toHaveLength(2);
			expect(customizations[0].isCustomized).toBe(false);
			expect(customizations[1].isCustomized).toBe(false);
		});

		test("should handle empty directory", async () => {
			await mkdir(currentSkillsDir, { recursive: true });

			const customizations = await SkillsCustomizationScanner.scanCustomizations(currentSkillsDir);

			expect(customizations).toHaveLength(0);
		});

		test("should skip hidden directories and node_modules", async () => {
			await mkdir(join(currentSkillsDir, ".hidden"));
			await writeFile(join(currentSkillsDir, ".hidden", "file.txt"), "hidden");
			await mkdir(join(currentSkillsDir, "node_modules"));
			await writeFile(join(currentSkillsDir, "node_modules", "file.txt"), "node");
			await mkdir(join(currentSkillsDir, "valid-skill"));
			await writeFile(join(currentSkillsDir, "valid-skill", "skill.md"), "valid");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(currentSkillsDir);

			expect(customizations).toHaveLength(1);
			expect(customizations[0].skillName).toBe("valid-skill");
		});
	});

	describe("scanCustomizations - with baseline directory", () => {
		test("should detect unchanged skills", async () => {
			// Create identical skills
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "identical content");

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "identical content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations).toHaveLength(1);
			expect(customizations[0].skillName).toBe("skill1");
			expect(customizations[0].isCustomized).toBe(false);
		});

		test("should detect modified skills", async () => {
			// Create modified skill
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "modified content");

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "original content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations).toHaveLength(1);
			expect(customizations[0].skillName).toBe("skill1");
			expect(customizations[0].isCustomized).toBe(true);
			expect(customizations[0].changes).toBeDefined();
			expect(customizations[0].changes?.length).toBeGreaterThan(0);
		});

		test("should detect added files in skill", async () => {
			// Current has additional file
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "content");
			await writeFile(join(currentSkillsDir, "skill1", "extra.md"), "extra file");

			// Baseline has only one file
			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);
			expect(customizations[0].changes).toBeDefined();

			const addedFile = customizations[0].changes?.find((c) => c.type === "added");
			expect(addedFile).toBeDefined();
			expect(addedFile?.file).toBe("extra.md");
		});

		test("should detect deleted files in skill", async () => {
			// Current has fewer files
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "content");

			// Baseline has additional file
			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "content");
			await writeFile(join(baselineSkillsDir, "skill1", "removed.md"), "removed file");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);
			expect(customizations[0].changes).toBeDefined();

			const deletedFile = customizations[0].changes?.find((c) => c.type === "deleted");
			expect(deletedFile).toBeDefined();
			expect(deletedFile?.file).toBe("removed.md");
		});

		test("should detect modified files in skill", async () => {
			// Current has modified file
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "new content");

			// Baseline has original file
			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "old content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);
			expect(customizations[0].changes).toBeDefined();

			const modifiedFile = customizations[0].changes?.find((c) => c.type === "modified");
			expect(modifiedFile).toBeDefined();
			expect(modifiedFile?.file).toBe("skill.md");
			expect(modifiedFile?.oldHash).toBeDefined();
			expect(modifiedFile?.newHash).toBeDefined();
			expect(modifiedFile?.oldHash).not.toBe(modifiedFile?.newHash);
		});

		test("should detect custom skills not in baseline", async () => {
			// Current has skill not in baseline
			await mkdir(join(currentSkillsDir, "custom-skill"));
			await writeFile(join(currentSkillsDir, "custom-skill", "skill.md"), "custom");

			await mkdir(join(baselineSkillsDir, "standard-skill"));
			await writeFile(join(baselineSkillsDir, "standard-skill", "skill.md"), "standard");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations).toHaveLength(1);
			expect(customizations[0].skillName).toBe("custom-skill");
			expect(customizations[0].isCustomized).toBe(true);
		});

		test("should handle nested file structures", async () => {
			// Current has nested structure
			await mkdir(join(currentSkillsDir, "skill1", "subdir"), { recursive: true });
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "main");
			await writeFile(join(currentSkillsDir, "skill1", "subdir", "nested.md"), "nested modified");

			// Baseline has same structure with different nested content
			await mkdir(join(baselineSkillsDir, "skill1", "subdir"), { recursive: true });
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "main");
			await writeFile(join(baselineSkillsDir, "skill1", "subdir", "nested.md"), "nested original");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);

			const modifiedFile = customizations[0].changes?.find(
				(c) => c.type === "modified" && c.file.includes("nested"),
			);
			expect(modifiedFile).toBeDefined();
		});

		test("should handle multiple customized skills", async () => {
			// Create multiple skills with different customizations
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "modified");
			await mkdir(join(currentSkillsDir, "skill2"));
			await writeFile(join(currentSkillsDir, "skill2", "skill.md"), "unchanged");
			await mkdir(join(currentSkillsDir, "skill3"));
			await writeFile(join(currentSkillsDir, "skill3", "skill.md"), "also modified");

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "original");
			await mkdir(join(baselineSkillsDir, "skill2"));
			await writeFile(join(baselineSkillsDir, "skill2", "skill.md"), "unchanged");
			await mkdir(join(baselineSkillsDir, "skill3"));
			await writeFile(join(baselineSkillsDir, "skill3", "skill.md"), "different");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations).toHaveLength(3);

			const customized = customizations.filter((c) => c.isCustomized);
			expect(customized).toHaveLength(2);

			const customizedNames = customized.map((c) => c.skillName).sort();
			expect(customizedNames).toEqual(["skill1", "skill3"]);
		});
	});

	describe("scanCustomizations - with manifest", () => {
		test("should use manifest hashes for comparison", async () => {
			// Create skill
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "content");

			// Generate manifest with hash
			const manifest = await SkillsManifestManager.generateManifest(currentSkillsDir);

			// Modify skill after manifest
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "modified content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				undefined,
				manifest,
			);

			expect(customizations[0].isCustomized).toBe(true);
		});

		test("should detect unchanged skill via manifest", async () => {
			// Create skill
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "content");

			// Generate manifest
			const manifest = await SkillsManifestManager.generateManifest(currentSkillsDir);

			// Scan without changes
			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				undefined,
				manifest,
			);

			expect(customizations[0].isCustomized).toBe(false);
		});

		test("should fallback to baseline when skill not in manifest", async () => {
			// Create skills
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "modified");

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "original");

			// Manifest with different skill
			const manifest = await SkillsManifestManager.generateManifest(currentSkillsDir);
			manifest.skills = [{ name: "other-skill", hash: "abc123" }];

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
				manifest,
			);

			expect(customizations[0].isCustomized).toBe(true);
		});
	});

	describe("scanCustomizations - categorized structure", () => {
		test("should handle categorized directory structure", async () => {
			// Create categorized current structure
			await mkdir(join(currentSkillsDir, "category1", "skill1"), { recursive: true });
			await writeFile(join(currentSkillsDir, "category1", "skill1", "skill.md"), "modified");

			// Create categorized baseline structure
			await mkdir(join(baselineSkillsDir, "category1", "skill1"), { recursive: true });
			await writeFile(join(baselineSkillsDir, "category1", "skill1", "skill.md"), "original");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations).toHaveLength(1);
			expect(customizations[0].skillName).toBe("skill1");
			expect(customizations[0].isCustomized).toBe(true);
		});

		test("should handle multiple categories", async () => {
			// Create skills in different categories
			await mkdir(join(currentSkillsDir, "cat1", "skill1"), { recursive: true });
			await writeFile(join(currentSkillsDir, "cat1", "skill1", "skill.md"), "content1");
			await mkdir(join(currentSkillsDir, "cat2", "skill2"), { recursive: true });
			await writeFile(join(currentSkillsDir, "cat2", "skill2", "skill.md"), "content2");

			await mkdir(join(baselineSkillsDir, "cat1", "skill1"), { recursive: true });
			await writeFile(join(baselineSkillsDir, "cat1", "skill1", "skill.md"), "content1");
			await mkdir(join(baselineSkillsDir, "cat2", "skill2"), { recursive: true });
			await writeFile(join(baselineSkillsDir, "cat2", "skill2", "skill.md"), "different");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations).toHaveLength(2);

			const customized = customizations.find((c) => c.skillName === "skill2");
			expect(customized?.isCustomized).toBe(true);

			const unchanged = customizations.find((c) => c.skillName === "skill1");
			expect(unchanged?.isCustomized).toBe(false);
		});
	});

	describe("scanCustomizations - edge cases", () => {
		test("should handle skills with binary files", async () => {
			// Create skill with binary file
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "text");
			await writeFile(
				join(currentSkillsDir, "skill1", "image.png"),
				Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG header
			);

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "text");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);
		});

		test("should handle skills with special characters in filenames", async () => {
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "file-with-dash.md"), "content");
			await writeFile(join(currentSkillsDir, "skill1", "file_with_underscore.md"), "content");

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "file-with-dash.md"), "content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);

			const addedFile = customizations[0].changes?.find((c) => c.type === "added");
			expect(addedFile?.file).toBe("file_with_underscore.md");
		});

		test("should handle empty skill directories", async () => {
			await mkdir(join(currentSkillsDir, "empty-skill"));
			await mkdir(join(baselineSkillsDir, "empty-skill"));

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(false);
		});

		test("should handle large files", async () => {
			const largeContent = "x".repeat(10000); // 10KB content

			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "large.md"), largeContent);

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "large.md"), "small");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);
		});
	});

	describe("scanCustomizations - file change details", () => {
		test("should include hash information in changes", async () => {
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "skill.md"), "new content");

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "skill.md"), "old content");

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			const modifiedChange = customizations[0].changes?.find((c) => c.type === "modified");

			expect(modifiedChange?.oldHash).toBeDefined();
			expect(modifiedChange?.newHash).toBeDefined();
			expect(modifiedChange?.oldHash).not.toBe(modifiedChange?.newHash);
			expect(modifiedChange?.oldHash?.length).toBe(64); // SHA-256 hex length
			expect(modifiedChange?.newHash?.length).toBe(64);
		});

		test("should include all change types in one skill", async () => {
			// Skill with added, modified, and deleted files
			await mkdir(join(currentSkillsDir, "skill1"));
			await writeFile(join(currentSkillsDir, "skill1", "modified.md"), "new");
			await writeFile(join(currentSkillsDir, "skill1", "added.md"), "added");
			// deleted.md is missing

			await mkdir(join(baselineSkillsDir, "skill1"));
			await writeFile(join(baselineSkillsDir, "skill1", "modified.md"), "old");
			await writeFile(join(baselineSkillsDir, "skill1", "deleted.md"), "deleted");
			// added.md is missing

			const customizations = await SkillsCustomizationScanner.scanCustomizations(
				currentSkillsDir,
				baselineSkillsDir,
			);

			expect(customizations[0].isCustomized).toBe(true);
			expect(customizations[0].changes).toHaveLength(3);

			const changeTypes = customizations[0].changes?.map((c) => c.type).sort();
			expect(changeTypes).toEqual(["added", "deleted", "modified"]);
		});
	});
});
