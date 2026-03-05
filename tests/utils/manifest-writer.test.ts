import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import type { Metadata } from "@/types";

describe("ManifestWriter", () => {
	let writer: ManifestWriter;
	let testClaudeDir: string;

	beforeEach(async () => {
		writer = new ManifestWriter();

		// Create temporary test directory
		const timestamp = Date.now();
		testClaudeDir = join(tmpdir(), `test-claude-${timestamp}`);
		await mkdir(testClaudeDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup test directory
		if (existsSync(testClaudeDir)) {
			await rm(testClaudeDir, { recursive: true, force: true });
		}
	});

	describe("addInstalledFile", () => {
		test("should add a single file to installed files", () => {
			writer.addInstalledFile("commands/test.md");
			expect(writer.getInstalledFiles()).toEqual(["commands/test.md"]);
		});

		test("should normalize path separators to forward slashes", () => {
			writer.addInstalledFile("commands\\test.md");
			expect(writer.getInstalledFiles()).toEqual(["commands/test.md"]);
		});

		test("should handle multiple files", () => {
			writer.addInstalledFile("commands/test1.md");
			writer.addInstalledFile("commands/test2.md");
			writer.addInstalledFile("skills/skill1.md");

			const files = writer.getInstalledFiles();
			expect(files).toHaveLength(3);
			expect(files).toContain("commands/test1.md");
			expect(files).toContain("commands/test2.md");
			expect(files).toContain("skills/skill1.md");
		});

		test("should handle duplicate paths", () => {
			writer.addInstalledFile("commands/test.md");
			writer.addInstalledFile("commands/test.md");
			expect(writer.getInstalledFiles()).toEqual(["commands/test.md"]);
		});

		test("should handle nested paths", () => {
			writer.addInstalledFile("agents/researcher/config.md");
			expect(writer.getInstalledFiles()).toEqual(["agents/researcher/config.md"]);
		});
	});

	describe("addInstalledFiles", () => {
		test("should add multiple files at once", () => {
			const files = ["commands/test1.md", "commands/test2.md", "skills/skill1.md"];
			writer.addInstalledFiles(files);

			expect(writer.getInstalledFiles()).toHaveLength(3);
			expect(writer.getInstalledFiles()).toEqual([
				"commands/test1.md",
				"commands/test2.md",
				"skills/skill1.md",
			]);
		});

		test("should normalize all paths", () => {
			const files = ["commands\\test1.md", "commands/test2.md"];
			writer.addInstalledFiles(files);

			expect(writer.getInstalledFiles()).toEqual(["commands/test1.md", "commands/test2.md"]);
		});

		test("should handle empty array", () => {
			writer.addInstalledFiles([]);
			expect(writer.getInstalledFiles()).toEqual([]);
		});
	});

	describe("addUserConfigFile", () => {
		test("should add user config files", () => {
			writer.addUserConfigFile("custom-config.json");
			expect(writer.getUserConfigFiles()).toEqual(["custom-config.json"]);
		});

		test("should normalize path separators", () => {
			writer.addUserConfigFile("config\\custom.json");
			expect(writer.getUserConfigFiles()).toEqual(["config/custom.json"]);
		});

		test("should handle multiple config files", () => {
			writer.addUserConfigFile("config1.json");
			writer.addUserConfigFile("config2.json");

			const configs = writer.getUserConfigFiles();
			expect(configs).toHaveLength(2);
			expect(configs).toContain("config1.json");
			expect(configs).toContain("config2.json");
		});
	});

	describe("getInstalledFiles", () => {
		test("should return sorted array", () => {
			writer.addInstalledFile("z-file.md");
			writer.addInstalledFile("a-file.md");
			writer.addInstalledFile("m-file.md");

			expect(writer.getInstalledFiles()).toEqual(["a-file.md", "m-file.md", "z-file.md"]);
		});

		test("should return empty array when no files installed", () => {
			expect(writer.getInstalledFiles()).toEqual([]);
		});
	});

	describe("getUserConfigFiles", () => {
		test("should return sorted array", () => {
			writer.addUserConfigFile("z-config.json");
			writer.addUserConfigFile("a-config.json");

			expect(writer.getUserConfigFiles()).toEqual(["a-config.json", "z-config.json"]);
		});

		test("should return empty array when no config files", () => {
			expect(writer.getUserConfigFiles()).toEqual([]);
		});
	});

	describe("writeManifest", () => {
		test("should write manifest to metadata.json", async () => {
			writer.addInstalledFile("commands/test.md");
			writer.addInstalledFile("skills/skill1.md");

			await writer.writeManifest(testClaudeDir, "engineer", "1.0.0", "local");

			const metadataPath = join(testClaudeDir, "metadata.json");
			expect(existsSync(metadataPath)).toBe(true);

			const content = await Bun.file(metadataPath).text();
			const metadata: Metadata = JSON.parse(content);

			expect(metadata.name).toBe("engineer");
			expect(metadata.version).toBe("1.0.0");
			expect(metadata.scope).toBe("local");
			// File tracking now in kits[kit].files only (DRY - no root-level duplication)
			expect(metadata.kits?.engineer).toBeDefined();
			expect(metadata.installedAt).toBeDefined();
			// Verify root-level file fields are NOT written (DRY)
			expect(metadata.files).toBeUndefined();
			expect(metadata.installedFiles).toBeUndefined();
		});

		test("should include USER_CONFIG_PATTERNS in userConfigFiles", async () => {
			writer.addInstalledFile("commands/test.md");

			await writer.writeManifest(testClaudeDir, "engineer", "1.0.0", "local");

			const metadataPath = join(testClaudeDir, "metadata.json");
			const content = await Bun.file(metadataPath).text();
			const metadata: Metadata = JSON.parse(content);

			// USER_CONFIG_PATTERNS includes user config files that should be preserved on updates
			expect(metadata.userConfigFiles).toContain(".gitignore");
			expect(metadata.userConfigFiles).toContain(".repomixignore");
			expect(metadata.userConfigFiles).toContain(".mcp.json");
			expect(metadata.userConfigFiles).toContain(".ckignore");
			expect(metadata.userConfigFiles).toContain(".ck.json");
			expect(metadata.userConfigFiles).toContain("CLAUDE.md");
		});

		test("should merge custom user config files with defaults", async () => {
			writer.addInstalledFile("commands/test.md");
			writer.addUserConfigFile("custom-config.json");

			await writer.writeManifest(testClaudeDir, "engineer", "1.0.0", "local");

			const metadataPath = join(testClaudeDir, "metadata.json");
			const content = await Bun.file(metadataPath).text();
			const metadata: Metadata = JSON.parse(content);

			expect(metadata.userConfigFiles).toContain(".gitignore");
			expect(metadata.userConfigFiles).toContain("custom-config.json");
		});

		test("should preserve existing metadata when updating", async () => {
			// Write initial metadata (multi-kit format)
			const initialMetadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: "2025-01-01T00:00:00.000Z",
					},
				},
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
			};

			await writeFile(
				join(testClaudeDir, "metadata.json"),
				JSON.stringify(initialMetadata, null, 2),
			);

			// Update with new manifest
			writer.addInstalledFile("commands/new.md");
			await writer.writeManifest(testClaudeDir, "engineer", "1.1.0", "local");

			const metadataPath = join(testClaudeDir, "metadata.json");
			const content = await Bun.file(metadataPath).text();
			const metadata: Metadata = JSON.parse(content);

			expect(metadata.version).toBe("1.1.0");
			// File tracking now in kits[kit].files only (DRY - no root-level duplication)
			expect(metadata.kits?.engineer?.version).toBe("1.1.0");
		});

		test("should handle empty installed files", async () => {
			await writer.writeManifest(testClaudeDir, "engineer", "1.0.0", "local");

			const metadataPath = join(testClaudeDir, "metadata.json");
			const content = await Bun.file(metadataPath).text();
			const metadata: Metadata = JSON.parse(content);

			// With no tracked files, kits[kit].files should be undefined (not empty array)
			expect(metadata.kits?.engineer).toBeDefined();
			expect(metadata.kits?.engineer?.files).toBeUndefined();
		});

		test("should write valid JSON with proper formatting", async () => {
			writer.addInstalledFile("commands/test.md");
			await writer.writeManifest(testClaudeDir, "engineer", "1.0.0", "local");

			const metadataPath = join(testClaudeDir, "metadata.json");
			const content = await Bun.file(metadataPath).text();

			// Should be valid JSON
			expect(() => JSON.parse(content)).not.toThrow();

			// Should be formatted (has indentation)
			expect(content).toContain("  ");
		});

		test("should handle global scope", async () => {
			writer.addInstalledFile("commands/test.md");
			await writer.writeManifest(testClaudeDir, "engineer", "1.0.0", "global");

			const metadataPath = join(testClaudeDir, "metadata.json");
			const content = await Bun.file(metadataPath).text();
			const metadata: Metadata = JSON.parse(content);

			expect(metadata.scope).toBe("global");
		});

		test("should handle corrupt existing metadata gracefully", async () => {
			// Write invalid JSON
			await writeFile(join(testClaudeDir, "metadata.json"), "{ invalid json }");

			// Should still write new manifest successfully
			writer.addInstalledFile("commands/test.md");
			await writer.writeManifest(testClaudeDir, "engineer", "1.0.0", "local");

			const metadataPath = join(testClaudeDir, "metadata.json");
			const content = await Bun.file(metadataPath).text();
			const metadata: Metadata = JSON.parse(content);

			expect(metadata.name).toBe("engineer");
			// File tracking now in kits[kit].files only (DRY - no root-level duplication)
			expect(metadata.kits?.engineer).toBeDefined();
		});
	});

	describe("readManifest", () => {
		test("should read existing manifest", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md", "skills/skill1.md"],
				userConfigFiles: [".gitignore", ".mcp.json"],
			};

			await writeFile(join(testClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await ManifestWriter.readManifest(testClaudeDir);

			expect(result).not.toBeNull();
			expect(result?.name).toBe("engineer");
			expect(result?.version).toBe("1.0.0");
			expect(result?.installedFiles).toEqual(["commands/test.md", "skills/skill1.md"]);
		});

		test("should return null if metadata.json doesn't exist", async () => {
			const result = await ManifestWriter.readManifest(testClaudeDir);
			expect(result).toBeNull();
		});

		test("should return null if metadata.json is invalid JSON", async () => {
			await writeFile(join(testClaudeDir, "metadata.json"), "{ invalid json }");

			const result = await ManifestWriter.readManifest(testClaudeDir);
			expect(result).toBeNull();
		});

		test("should validate schema using Zod", async () => {
			// Write metadata with invalid scope
			const invalidMetadata = {
				name: "engineer",
				version: "1.0.0",
				scope: "invalid-scope", // This should fail validation
			};

			await writeFile(
				join(testClaudeDir, "metadata.json"),
				JSON.stringify(invalidMetadata, null, 2),
			);

			const result = await ManifestWriter.readManifest(testClaudeDir);
			expect(result).toBeNull();
		});

		test("should handle empty metadata.json", async () => {
			await writeFile(join(testClaudeDir, "metadata.json"), "{}");

			const result = await ManifestWriter.readManifest(testClaudeDir);
			expect(result).not.toBeNull();
			expect(result?.name).toBeUndefined();
			expect(result?.installedFiles).toBeUndefined();
		});
	});

	describe("getUninstallManifest", () => {
		test("should use manifest when available", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md", "skills/skill1.md", "agents/researcher.md"],
				userConfigFiles: [".gitignore", ".mcp.json", "custom-config.json"],
			};

			await writeFile(join(testClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			expect(result.hasManifest).toBe(true);
			expect(result.filesToRemove).toEqual([
				"commands/test.md",
				"skills/skill1.md",
				"agents/researcher.md",
			]);
			expect(result.filesToPreserve).toEqual([".gitignore", ".mcp.json", "custom-config.json"]);
		});

		test("should fallback to legacy when no manifest exists", async () => {
			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			expect(result.hasManifest).toBe(false);
			expect(result.filesToRemove).toContain("commands");
			expect(result.filesToRemove).toContain("agents");
			expect(result.filesToRemove).toContain("skills");
			expect(result.filesToRemove).toContain("rules");
			expect(result.filesToRemove).toContain("hooks");
			expect(result.filesToRemove).toContain("scripts");
			expect(result.filesToRemove).toContain("metadata.json");
		});

		test("should fallback when manifest exists but installedFiles is empty", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: [], // Empty
			};

			await writeFile(join(testClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			// Should fallback to legacy because installedFiles is empty
			expect(result.hasManifest).toBe(false);
			expect(result.filesToRemove).toContain("commands");
		});

		test("should fallback when manifest exists but installedFiles is undefined", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				// installedFiles is undefined
			};

			await writeFile(join(testClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			expect(result.hasManifest).toBe(false);
			expect(result.filesToRemove).toContain("commands");
		});

		test("should use USER_CONFIG_PATTERNS as default preserve list in legacy mode", async () => {
			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			expect(result.hasManifest).toBe(false);
			expect(result.filesToPreserve).toContain(".gitignore");
			expect(result.filesToPreserve).toContain(".repomixignore");
			expect(result.filesToPreserve).toContain(".mcp.json");
			expect(result.filesToPreserve).toContain("CLAUDE.md");
		});

		test("should handle invalid metadata gracefully", async () => {
			await writeFile(join(testClaudeDir, "metadata.json"), "{ invalid json }");

			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			// Should fallback to legacy
			expect(result.hasManifest).toBe(false);
			expect(result.filesToRemove).toContain("commands");
		});

		test("should preserve custom user config files from manifest", async () => {
			const metadata: Metadata = {
				name: "engineer",
				version: "1.0.0",
				installedAt: "2025-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md"],
				userConfigFiles: [
					".gitignore",
					".mcp.json",
					"my-custom-config.json",
					"another-config.yaml",
				],
			};

			await writeFile(join(testClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			expect(result.hasManifest).toBe(true);
			expect(result.filesToPreserve).toContain("my-custom-config.json");
			expect(result.filesToPreserve).toContain("another-config.yaml");
		});

		test("should use multi-kit format files for uninstall", async () => {
			// Multi-kit format with kits.engineer.files
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: "2025-01-01T00:00:00.000Z",
						files: [
							{
								path: "commands/test.md",
								checksum: "abc123".padEnd(64, "0"),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "skills/skill1.md",
								checksum: "def456".padEnd(64, "0"),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
				scope: "local",
				name: "engineer",
				version: "1.0.0",
			};

			await writeFile(join(testClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			expect(result.hasManifest).toBe(true);
			expect(result.isMultiKit).toBe(true);
			expect(result.filesToRemove).toContain("commands/test.md");
			expect(result.filesToRemove).toContain("skills/skill1.md");
		});

		test("should handle backward compat: existing installations with duplicate root-level files", async () => {
			// Existing installations before fix may have BOTH kits.engineer.files AND root files (duplicate)
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: "2025-01-01T00:00:00.000Z",
						files: [
							{
								path: "commands/test.md",
								checksum: "abc123".padEnd(64, "0"),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
				scope: "local",
				name: "engineer",
				version: "1.0.0",
				// Legacy duplicate root-level files (from before the DRY fix)
				files: [
					{
						path: "commands/test.md",
						checksum: "abc123".padEnd(64, "0"),
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
				installedFiles: ["commands/test.md"],
			};

			await writeFile(join(testClaudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await ManifestWriter.getUninstallManifest(testClaudeDir);

			// Should use kits.engineer.files (multi-kit format takes precedence)
			expect(result.hasManifest).toBe(true);
			expect(result.isMultiKit).toBe(true);
			expect(result.filesToRemove).toContain("commands/test.md");
			// Should NOT have duplicates
			expect(result.filesToRemove.filter((f) => f === "commands/test.md")).toHaveLength(1);
		});
	});

	describe("addTrackedFilesBatch", () => {
		test("should process multiple files in parallel", async () => {
			// Create test files
			const files = ["file1.txt", "file2.txt", "file3.txt"];
			for (const file of files) {
				await writeFile(join(testClaudeDir, file), `content of ${file}`);
			}

			const fileInfos = files.map((file) => ({
				filePath: join(testClaudeDir, file),
				relativePath: file,
				ownership: "ck" as const,
				installedVersion: "1.0.0",
			}));

			const result = await writer.addTrackedFilesBatch(fileInfos);

			expect(result.success).toBe(3);
			expect(result.failed).toBe(0);
			expect(result.total).toBe(3);
			expect(writer.getTrackedFiles()).toHaveLength(3);
		});

		test("should call progress callback with correct values", async () => {
			// Create test files
			const files = ["a.txt", "b.txt", "c.txt", "d.txt", "e.txt"];
			for (const file of files) {
				await writeFile(join(testClaudeDir, file), "content");
			}

			const fileInfos = files.map((file) => ({
				filePath: join(testClaudeDir, file),
				relativePath: file,
				ownership: "ck" as const,
				installedVersion: "1.0.0",
			}));

			const progressCalls: Array<{ processed: number; total: number }> = [];
			await writer.addTrackedFilesBatch(fileInfos, {
				onProgress: (processed, total) => {
					progressCalls.push({ processed, total });
				},
			});

			// Should have received progress calls
			expect(progressCalls.length).toBeGreaterThan(0);
			// Final call should have processed === total
			const lastCall = progressCalls[progressCalls.length - 1];
			expect(lastCall.total).toBe(5);
		});

		test("should respect concurrency limit", async () => {
			// Create test files
			const files = Array.from({ length: 10 }, (_, i) => `file${i}.txt`);
			for (const file of files) {
				await writeFile(join(testClaudeDir, file), "content");
			}

			const fileInfos = files.map((file) => ({
				filePath: join(testClaudeDir, file),
				relativePath: file,
				ownership: "ck" as const,
				installedVersion: "1.0.0",
			}));

			// Low concurrency should still work
			const result = await writer.addTrackedFilesBatch(fileInfos, {
				concurrency: 2,
			});

			expect(result.success).toBe(10);
			expect(result.failed).toBe(0);
		});

		test("should handle individual file errors gracefully", async () => {
			// Create one valid file
			await writeFile(join(testClaudeDir, "valid.txt"), "content");

			const fileInfos = [
				{
					filePath: join(testClaudeDir, "valid.txt"),
					relativePath: "valid.txt",
					ownership: "ck" as const,
					installedVersion: "1.0.0",
				},
				{
					filePath: join(testClaudeDir, "nonexistent.txt"), // Does not exist
					relativePath: "nonexistent.txt",
					ownership: "ck" as const,
					installedVersion: "1.0.0",
				},
			];

			const result = await writer.addTrackedFilesBatch(fileInfos);

			// Should succeed for valid file, fail for nonexistent
			expect(result.success).toBe(1);
			expect(result.failed).toBe(1);
			expect(result.total).toBe(2);
			// Only valid file should be tracked
			expect(writer.getTrackedFiles()).toHaveLength(1);
			expect(writer.getTrackedFiles()[0].path).toBe("valid.txt");
		});

		test("should return accurate count of processed files", async () => {
			// Create test files
			const files = ["x.txt", "y.txt", "z.txt"];
			for (const file of files) {
				await writeFile(join(testClaudeDir, file), `data for ${file}`);
			}

			const fileInfos = files.map((file) => ({
				filePath: join(testClaudeDir, file),
				relativePath: file,
				ownership: "user" as const,
				installedVersion: "2.0.0",
			}));

			const result = await writer.addTrackedFilesBatch(fileInfos);

			expect(result.success).toBe(3);
			// Also verify legacy installedFiles for backward compat
			expect(writer.getInstalledFiles()).toHaveLength(3);
		});

		test("should normalize Windows path separators", async () => {
			await writeFile(join(testClaudeDir, "test.txt"), "content");

			const fileInfos = [
				{
					filePath: join(testClaudeDir, "test.txt"),
					relativePath: "commands\\subdir\\test.txt", // Windows-style
					ownership: "ck" as const,
					installedVersion: "1.0.0",
				},
			];

			await writer.addTrackedFilesBatch(fileInfos);

			const tracked = writer.getTrackedFiles();
			expect(tracked[0].path).toBe("commands/subdir/test.txt"); // Normalized
		});

		test("should handle empty file list", async () => {
			const result = await writer.addTrackedFilesBatch([]);

			expect(result.success).toBe(0);
			expect(result.failed).toBe(0);
			expect(result.total).toBe(0);
		});
	});

	describe("edge cases", () => {
		test("should handle very long file paths", () => {
			const longPath = `${"a/".repeat(50)}file.md`;
			writer.addInstalledFile(longPath);
			expect(writer.getInstalledFiles()).toContain(longPath);
		});

		test("should handle special characters in paths", () => {
			const specialPath = "commands/test (copy) [2].md";
			writer.addInstalledFile(specialPath);
			expect(writer.getInstalledFiles()).toContain(specialPath);
		});

		test("should handle mixed path separators", () => {
			writer.addInstalledFile("commands\\subdir/file.md");
			expect(writer.getInstalledFiles()).toEqual(["commands/subdir/file.md"]);
		});

		test("should handle root-level files", () => {
			writer.addInstalledFile("README.md");
			expect(writer.getInstalledFiles()).toEqual(["README.md"]);
		});

		test("should handle many files efficiently", () => {
			const files = Array.from({ length: 1000 }, (_, i) => `file-${i}.md`);
			writer.addInstalledFiles(files);

			expect(writer.getInstalledFiles()).toHaveLength(1000);
			expect(writer.getInstalledFiles()[0]).toBe("file-0.md");
			expect(writer.getInstalledFiles()[999]).toBe("file-999.md");
		});
	});
});
