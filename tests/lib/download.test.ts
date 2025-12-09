import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DownloadManager } from "../../src/domains/installation/download-manager.js";
import { DownloadError, ExtractionError } from "../../src/types/index.js";

describe("DownloadManager", () => {
	let manager: DownloadManager;
	let testDir: string;

	beforeEach(async () => {
		manager = new DownloadManager();
		testDir = join(process.cwd(), "test-temp", `test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		if (existsSync(testDir)) {
			await rm(testDir, { recursive: true, force: true });
		}
	});

	describe("constructor", () => {
		test("should create DownloadManager instance", () => {
			expect(manager).toBeInstanceOf(DownloadManager);
		});
	});

	describe("normalizeZipEntryName", () => {
		test("should decode UTF-8 buffer entries", () => {
			const utf8Buffer = Buffer.from("中文.txt", "utf8");
			const normalized = (manager as any).normalizeZipEntryName(utf8Buffer);
			expect(normalized).toBe("中文.txt");
		});

		test("should repair mojibake string entries", () => {
			const mojibake = "â%9()/file.txt";
			const normalized = (manager as any).normalizeZipEntryName(mojibake);
			expect(normalized).toBe("’%9()/file.txt");
		});
	});

	describe("createTempDir", () => {
		test("should create temporary directory", async () => {
			const tempDir = await manager.createTempDir();

			expect(tempDir).toBeDefined();
			expect(typeof tempDir).toBe("string");
			expect(tempDir).toContain("claudekit-");
			expect(existsSync(tempDir)).toBe(true);

			// Cleanup
			await rm(tempDir, { recursive: true, force: true });
		});

		test("should create unique directories", async () => {
			const tempDir1 = await manager.createTempDir();

			// Wait 1ms to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 1));

			const tempDir2 = await manager.createTempDir();

			expect(tempDir1).not.toBe(tempDir2);

			// Cleanup
			await rm(tempDir1, { recursive: true, force: true });
			await rm(tempDir2, { recursive: true, force: true });
		});
	});

	describe("validateExtraction", () => {
		test("should throw error for empty directory", async () => {
			const emptyDir = join(testDir, "empty");
			await mkdir(emptyDir, { recursive: true });

			await expect(manager.validateExtraction(emptyDir)).rejects.toThrow(ExtractionError);
			await expect(manager.validateExtraction(emptyDir)).rejects.toThrow(
				"Extraction resulted in no files",
			);
		});

		test("should pass validation for directory with .claude and CLAUDE.md", async () => {
			const validDir = join(testDir, "valid");
			await mkdir(join(validDir, ".claude"), { recursive: true });
			await writeFile(join(validDir, ".claude", "config.json"), "{}");
			await writeFile(join(validDir, "CLAUDE.md"), "# Test");

			// Should not throw
			await manager.validateExtraction(validDir);
		});

		test("should warn but not fail for directory with files but missing critical paths", async () => {
			const partialDir = join(testDir, "partial");
			await mkdir(partialDir, { recursive: true });
			await writeFile(join(partialDir, "README.md"), "# Test");

			// Should not throw but will log warnings
			await manager.validateExtraction(partialDir);
		});

		test("should throw error for non-existent directory", async () => {
			const nonExistentDir = join(testDir, "does-not-exist");

			await expect(manager.validateExtraction(nonExistentDir)).rejects.toThrow();
		});
	});

	describe("wrapper directory detection", () => {
		test("should detect version wrapper with v prefix", () => {
			// Access private method via any type casting for testing
			const isWrapper = (manager as any).isWrapperDirectory("project-v1.0.0");
			expect(isWrapper).toBe(true);
		});

		test("should detect version wrapper without v prefix", () => {
			const isWrapper = (manager as any).isWrapperDirectory("project-1.0.0");
			expect(isWrapper).toBe(true);
		});

		test("should detect commit hash wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory("project-abc1234");
			expect(isWrapper).toBe(true);
		});

		test("should detect prerelease version wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory("project-v1.0.0-alpha");
			expect(isWrapper).toBe(true);
		});

		test("should detect beta version wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory("project-v2.0.0-beta.1");
			expect(isWrapper).toBe(true);
		});

		test("should detect rc version wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory("repo-v3.0.0-rc.5");
			expect(isWrapper).toBe(true);
		});

		test("should not detect .claude as wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory(".claude");
			expect(isWrapper).toBe(false);
		});

		test("should not detect src as wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory("src");
			expect(isWrapper).toBe(false);
		});

		test("should not detect docs as wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory("docs");
			expect(isWrapper).toBe(false);
		});

		test("should not detect node_modules as wrapper", () => {
			const isWrapper = (manager as any).isWrapperDirectory("node_modules");
			expect(isWrapper).toBe(false);
		});
	});

	describe("path safety validation", () => {
		test("should allow safe relative paths", () => {
			const basePath = join(testDir, "base");
			const targetPath = join(testDir, "base", "subdir", "file.txt");
			const isSafe = (manager as any).isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(true);
		});

		test("should block path traversal attempts with ..", () => {
			const basePath = join(testDir, "base");
			const targetPath = join(testDir, "outside", "file.txt");
			const isSafe = (manager as any).isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(false);
		});

		test("should block absolute path attempts", () => {
			const basePath = join(testDir, "base");
			const targetPath = "/etc/passwd";
			const isSafe = (manager as any).isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(false);
		});

		test("should allow same directory", () => {
			const basePath = join(testDir, "base");
			const targetPath = join(testDir, "base");
			const isSafe = (manager as any).isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(true);
		});
	});

	describe("archive bomb protection", () => {
		test("should track extraction size", () => {
			const manager = new DownloadManager();

			// Add some file sizes
			(manager as any).checkExtractionSize(100 * 1024 * 1024); // 100MB
			expect((manager as any).totalExtractedSize).toBe(100 * 1024 * 1024);

			(manager as any).checkExtractionSize(200 * 1024 * 1024); // 200MB more
			expect((manager as any).totalExtractedSize).toBe(300 * 1024 * 1024);
		});

		test("should throw error when size exceeds limit", () => {
			const manager = new DownloadManager();

			expect(() => {
				(manager as any).checkExtractionSize(600 * 1024 * 1024); // 600MB
			}).toThrow(ExtractionError);

			expect(() => {
				(manager as any).checkExtractionSize(600 * 1024 * 1024); // 600MB
			}).toThrow("Archive exceeds maximum extraction size");
		});

		test("should allow extraction within limit", () => {
			const manager = new DownloadManager();

			expect(() => {
				(manager as any).checkExtractionSize(400 * 1024 * 1024); // 400MB
			}).not.toThrow();
		});

		test("should reset extraction size", () => {
			const manager = new DownloadManager();

			(manager as any).checkExtractionSize(300 * 1024 * 1024); // 300MB
			expect((manager as any).totalExtractedSize).toBe(300 * 1024 * 1024);

			(manager as any).resetExtractionSize();
			expect((manager as any).totalExtractedSize).toBe(0);
		});
	});

	describe("file exclusion", () => {
		test("should exclude .git directory", () => {
			const shouldExclude = (manager as any).shouldExclude(".git");
			expect(shouldExclude).toBe(true);
		});

		test("should exclude .git/** files", () => {
			const shouldExclude = (manager as any).shouldExclude(".git/config");
			expect(shouldExclude).toBe(true);
		});

		test("should exclude node_modules", () => {
			const shouldExclude = (manager as any).shouldExclude("node_modules");
			expect(shouldExclude).toBe(true);
		});

		test("should exclude .DS_Store", () => {
			const shouldExclude = (manager as any).shouldExclude(".DS_Store");
			expect(shouldExclude).toBe(true);
		});

		test("should not exclude normal files", () => {
			const shouldExclude = (manager as any).shouldExclude("src/index.ts");
			expect(shouldExclude).toBe(false);
		});

		test("should not exclude .claude directory", () => {
			const shouldExclude = (manager as any).shouldExclude(".claude");
			expect(shouldExclude).toBe(false);
		});
	});

	describe("archive type detection", () => {
		test("should detect .tar.gz archive", () => {
			const type = (manager as any).detectArchiveType("project-v1.0.0.tar.gz");
			expect(type).toBe("tar.gz");
		});

		test("should detect .tgz archive", () => {
			const type = (manager as any).detectArchiveType("project-v1.0.0.tgz");
			expect(type).toBe("tar.gz");
		});

		test("should detect .zip archive", () => {
			const type = (manager as any).detectArchiveType("project-v1.0.0.zip");
			expect(type).toBe("zip");
		});

		test("should throw error for unknown archive type", () => {
			expect(() => {
				(manager as any).detectArchiveType("project-v1.0.0.rar");
			}).toThrow(ExtractionError);
		});
	});

	describe("error classes", () => {
		test("DownloadError should store message", () => {
			const error = new DownloadError("Download failed");
			expect(error.message).toBe("Download failed");
			expect(error.code).toBe("DOWNLOAD_ERROR");
			expect(error.name).toBe("DownloadError");
		});

		test("ExtractionError should store message", () => {
			const error = new ExtractionError("Extraction failed");
			expect(error.message).toBe("Extraction failed");
			expect(error.code).toBe("EXTRACTION_ERROR");
			expect(error.name).toBe("ExtractionError");
		});
	});
});
