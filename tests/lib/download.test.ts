import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DownloadManager } from "@/domains/installation/download-manager.js";
import {
	ExtractionSizeTracker,
	detectArchiveType,
	isPathSafe,
	isWrapperDirectory,
	normalizeZipEntryName,
} from "@/domains/installation/utils/index.js";
import { DownloadError, ExtractionError } from "@/types";

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

/**
 * Tests for utility modules extracted from DownloadManager
 * These functions are now exported from @/domains/installation/utils/
 */
describe("Installation utilities", () => {
	describe("normalizeZipEntryName", () => {
		test("should decode UTF-8 buffer entries", () => {
			const utf8Buffer = Buffer.from("中文.txt", "utf8");
			const normalized = normalizeZipEntryName(utf8Buffer);
			expect(normalized).toBe("中文.txt");
		});

		test("should handle string entries with potential mojibake", () => {
			// Test that non-mojibake strings pass through unchanged
			const normalString = "normal-file.txt";
			const normalized = normalizeZipEntryName(normalString);
			expect(normalized).toBe("normal-file.txt");
		});
	});

	describe("wrapper directory detection", () => {
		test("should detect version wrapper with v prefix", () => {
			const isWrapper = isWrapperDirectory("project-v1.0.0");
			expect(isWrapper).toBe(true);
		});

		test("should detect version wrapper without v prefix", () => {
			const isWrapper = isWrapperDirectory("project-1.0.0");
			expect(isWrapper).toBe(true);
		});

		test("should detect commit hash wrapper", () => {
			const isWrapper = isWrapperDirectory("project-abc1234");
			expect(isWrapper).toBe(true);
		});

		test("should detect prerelease version wrapper", () => {
			const isWrapper = isWrapperDirectory("project-v1.0.0-alpha");
			expect(isWrapper).toBe(true);
		});

		test("should detect beta version wrapper", () => {
			const isWrapper = isWrapperDirectory("project-v2.0.0-beta.1");
			expect(isWrapper).toBe(true);
		});

		test("should detect rc version wrapper", () => {
			const isWrapper = isWrapperDirectory("repo-v3.0.0-rc.5");
			expect(isWrapper).toBe(true);
		});

		test("should not detect .claude as wrapper", () => {
			const isWrapper = isWrapperDirectory(".claude");
			expect(isWrapper).toBe(false);
		});

		test("should not detect src as wrapper", () => {
			const isWrapper = isWrapperDirectory("src");
			expect(isWrapper).toBe(false);
		});

		test("should not detect docs as wrapper", () => {
			const isWrapper = isWrapperDirectory("docs");
			expect(isWrapper).toBe(false);
		});

		test("should not detect node_modules as wrapper", () => {
			const isWrapper = isWrapperDirectory("node_modules");
			expect(isWrapper).toBe(false);
		});
	});

	describe("path safety validation", () => {
		const testDir = join(process.cwd(), "test-temp");

		test("should allow safe relative paths", () => {
			const basePath = join(testDir, "base");
			const targetPath = join(testDir, "base", "subdir", "file.txt");
			const isSafe = isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(true);
		});

		test("should block path traversal attempts with ..", () => {
			const basePath = join(testDir, "base");
			const targetPath = join(testDir, "outside", "file.txt");
			const isSafe = isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(false);
		});

		test("should block absolute path attempts", () => {
			const basePath = join(testDir, "base");
			const targetPath = "/etc/passwd";
			const isSafe = isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(false);
		});

		test("should allow same directory", () => {
			const basePath = join(testDir, "base");
			const targetPath = join(testDir, "base");
			const isSafe = isPathSafe(basePath, targetPath);
			expect(isSafe).toBe(true);
		});
	});

	describe("archive bomb protection", () => {
		test("should track extraction size", () => {
			const tracker = new ExtractionSizeTracker();

			// Add some file sizes
			tracker.checkExtractionSize(100 * 1024 * 1024); // 100MB
			// No error means success

			tracker.checkExtractionSize(200 * 1024 * 1024); // 200MB more
			// Still under limit
		});

		test("should throw error when size exceeds limit", () => {
			const tracker = new ExtractionSizeTracker();

			expect(() => {
				tracker.checkExtractionSize(600 * 1024 * 1024); // 600MB
			}).toThrow(ExtractionError);

			const tracker2 = new ExtractionSizeTracker();
			expect(() => {
				tracker2.checkExtractionSize(600 * 1024 * 1024); // 600MB
			}).toThrow("Archive exceeds maximum extraction size");
		});

		test("should allow extraction within limit", () => {
			const tracker = new ExtractionSizeTracker();

			expect(() => {
				tracker.checkExtractionSize(400 * 1024 * 1024); // 400MB
			}).not.toThrow();
		});

		test("should reset extraction size", () => {
			const tracker = new ExtractionSizeTracker();

			tracker.checkExtractionSize(300 * 1024 * 1024); // 300MB
			tracker.reset();
			// After reset, we should be able to add more without exceeding limit
			expect(() => {
				tracker.checkExtractionSize(400 * 1024 * 1024); // 400MB - would exceed if not reset
			}).not.toThrow();
		});
	});

	describe("archive type detection", () => {
		test("should detect .tar.gz archive", () => {
			const type = detectArchiveType("project-v1.0.0.tar.gz");
			expect(type).toBe("tar.gz");
		});

		test("should detect .tgz archive", () => {
			const type = detectArchiveType("project-v1.0.0.tgz");
			expect(type).toBe("tar.gz");
		});

		test("should detect .zip archive", () => {
			const type = detectArchiveType("project-v1.0.0.zip");
			expect(type).toBe("zip");
		});

		test("should throw error for unknown archive type", () => {
			expect(() => {
				detectArchiveType("project-v1.0.0.rar");
			}).toThrow(ExtractionError);
		});
	});
});
