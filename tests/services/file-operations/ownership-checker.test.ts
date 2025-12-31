import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import type { Metadata } from "@/types";

describe("OwnershipChecker", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("calculateChecksum", () => {
		test("calculates SHA-256 correctly", async () => {
			const testFile = join(tempDir, "test.txt");
			await writeFile(testFile, "hello world");

			const checksum = await OwnershipChecker.calculateChecksum(testFile);

			// Known SHA-256 of "hello world"
			expect(checksum).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
		});

		test("handles empty files", async () => {
			const testFile = join(tempDir, "empty.txt");
			await writeFile(testFile, "");

			const checksum = await OwnershipChecker.calculateChecksum(testFile);

			// Known SHA-256 of empty string
			expect(checksum).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
		});

		test("throws on missing file", async () => {
			const missingFile = join(tempDir, "missing.txt");

			await expect(OwnershipChecker.calculateChecksum(missingFile)).rejects.toThrow();
		});
	});

	describe("checkOwnership", () => {
		test("returns 'user' when no metadata", async () => {
			const testFile = join(tempDir, "test.txt");
			await writeFile(testFile, "content");

			const result = await OwnershipChecker.checkOwnership(testFile, null, tempDir);

			expect(result.ownership).toBe("user");
			expect(result.exists).toBe(true);
		});

		test("returns 'ck' when checksum matches metadata", async () => {
			const testFile = join(tempDir, "test.txt");
			await writeFile(testFile, "content");
			const checksum = await OwnershipChecker.calculateChecksum(testFile);

			const metadata: Metadata = {
				version: "1.0.0",
				files: [
					{
						path: "test.txt",
						checksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};

			const result = await OwnershipChecker.checkOwnership(testFile, metadata, tempDir);

			expect(result.ownership).toBe("ck");
			expect(result.expectedChecksum).toBe(checksum);
			expect(result.actualChecksum).toBe(checksum);
		});

		test("returns 'ck-modified' when checksum differs", async () => {
			const testFile = join(tempDir, "test.txt");
			await writeFile(testFile, "original");
			const originalChecksum = await OwnershipChecker.calculateChecksum(testFile);

			const metadata: Metadata = {
				version: "1.0.0",
				files: [
					{
						path: "test.txt",
						checksum: originalChecksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};

			// Modify file
			await writeFile(testFile, "modified");

			const result = await OwnershipChecker.checkOwnership(testFile, metadata, tempDir);

			expect(result.ownership).toBe("ck-modified");
			expect(result.expectedChecksum).toBe(originalChecksum);
			expect(result.actualChecksum).not.toBe(originalChecksum);
		});

		test("returns 'user' when file not in metadata", async () => {
			const testFile = join(tempDir, "custom.txt");
			await writeFile(testFile, "user content");

			const metadata: Metadata = {
				version: "1.0.0",
				files: [
					{
						path: "other.txt",
						checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd",
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};

			const result = await OwnershipChecker.checkOwnership(testFile, metadata, tempDir);

			expect(result.ownership).toBe("user");
		});

		test("returns 'user' with exists: false for missing file", async () => {
			const missingFile = join(tempDir, "missing.txt");

			const result = await OwnershipChecker.checkOwnership(missingFile, null, tempDir);

			expect(result.ownership).toBe("user");
			expect(result.exists).toBe(false);
		});

		test("handles nested paths correctly", async () => {
			const nestedDir = join(tempDir, "commands");
			await mkdir(nestedDir, { recursive: true });
			const nestedFile = join(nestedDir, "plan.md");
			await writeFile(nestedFile, "# Plan");
			const checksum = await OwnershipChecker.calculateChecksum(nestedFile);

			const metadata: Metadata = {
				version: "1.0.0",
				files: [
					{
						path: "commands/plan.md",
						checksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};

			const result = await OwnershipChecker.checkOwnership(nestedFile, metadata, tempDir);

			expect(result.ownership).toBe("ck");
		});
	});

	describe("checkBatch", () => {
		test("processes multiple files in parallel", async () => {
			const file1 = join(tempDir, "file1.txt");
			const file2 = join(tempDir, "file2.txt");
			await writeFile(file1, "content1");
			await writeFile(file2, "content2");

			const checksum1 = await OwnershipChecker.calculateChecksum(file1);

			const metadata: Metadata = {
				version: "1.0.0",
				files: [
					{
						path: "file1.txt",
						checksum: checksum1,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};

			const results = await OwnershipChecker.checkBatch([file1, file2], metadata, tempDir);

			expect(results.size).toBe(2);
			expect(results.get(file1)?.ownership).toBe("ck");
			expect(results.get(file2)?.ownership).toBe("user");
		});

		test("handles empty file list", async () => {
			const results = await OwnershipChecker.checkBatch([], null, tempDir);
			expect(results.size).toBe(0);
		});
	});
});
