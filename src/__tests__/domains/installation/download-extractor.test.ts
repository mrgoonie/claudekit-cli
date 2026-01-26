import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import { downloadAndExtract } from "@/domains/installation/download-extractor.js";
import { AVAILABLE_KITS } from "@/types";

const TEST_DIR = path.join(os.tmpdir(), "ck-test-offline");
const mockKit = AVAILABLE_KITS.engineer;

describe("downloadAndExtract - offline options", () => {
	beforeEach(async () => {
		await fs.promises.mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
	});

	describe("--kit-path option", () => {
		test("should use local directory when .claude exists", async () => {
			// Setup: create kit dir with .claude
			const kitDir = path.join(TEST_DIR, "my-kit");
			await fs.promises.mkdir(path.join(kitDir, ".claude"), { recursive: true });

			const result = await downloadAndExtract({
				kit: mockKit,
				kitPath: kitDir,
			});

			expect(result.extractDir).toBe(path.resolve(kitDir));
			expect(result.archivePath).toBe("");
		});

		test("should warn but proceed when .claude missing", async () => {
			// Setup: create kit dir WITHOUT .claude
			const kitDir = path.join(TEST_DIR, "no-claude-kit");
			await fs.promises.mkdir(kitDir, { recursive: true });

			// Should not throw, just warn
			const result = await downloadAndExtract({
				kit: mockKit,
				kitPath: kitDir,
			});

			expect(result.extractDir).toBe(path.resolve(kitDir));
		});

		test("should reject non-directory paths", async () => {
			// Setup: create a file, not directory
			const filePath = path.join(TEST_DIR, "not-a-dir.txt");
			await fs.promises.writeFile(filePath, "content");

			await expect(
				downloadAndExtract({
					kit: mockKit,
					kitPath: filePath,
				}),
			).rejects.toThrow(/must point to a directory/);
		});

		test("should reject non-existent paths", async () => {
			await expect(
				downloadAndExtract({
					kit: mockKit,
					kitPath: "/nonexistent/path",
				}),
			).rejects.toThrow(/not found/);
		});
	});

	describe("--archive option", () => {
		test("should reject non-file paths (directories)", async () => {
			// Use a directory instead of file with valid extension to bypass format check
			const dirPath = path.join(TEST_DIR, "not-a-file.zip");
			await fs.promises.mkdir(dirPath, { recursive: true });

			await expect(
				downloadAndExtract({
					kit: mockKit,
					archive: dirPath,
				}),
			).rejects.toThrow(/must point to a file/);
		});

		test("should reject empty archives", async () => {
			const emptyFile = path.join(TEST_DIR, "empty.zip");
			await fs.promises.writeFile(emptyFile, "");

			await expect(
				downloadAndExtract({
					kit: mockKit,
					archive: emptyFile,
				}),
			).rejects.toThrow(/empty/);
		});

		test("should reject non-existent archives", async () => {
			await expect(
				downloadAndExtract({
					kit: mockKit,
					archive: "/nonexistent/archive.zip",
				}),
			).rejects.toThrow(/not found/);
		});
	});

	describe("mutual exclusivity", () => {
		test("should reject --archive + --use-git", async () => {
			await expect(
				downloadAndExtract({
					kit: mockKit,
					archive: "/some/path.zip",
					useGit: true,
				}),
			).rejects.toThrow(/mutually exclusive/);
		});

		test("should reject --kit-path + --archive", async () => {
			await expect(
				downloadAndExtract({
					kit: mockKit,
					kitPath: "/some/dir",
					archive: "/some/path.zip",
				}),
			).rejects.toThrow(/mutually exclusive/);
		});

		test("should reject all three together", async () => {
			await expect(
				downloadAndExtract({
					kit: mockKit,
					kitPath: "/some/dir",
					archive: "/some/path.zip",
					useGit: true,
				}),
			).rejects.toThrow(/mutually exclusive/);
		});
	});
});
