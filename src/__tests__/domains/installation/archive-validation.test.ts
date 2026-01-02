import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import { downloadAndExtract } from "@/domains/installation/download-extractor";
import { AVAILABLE_KITS } from "@/types";

const TEST_DIR = path.join(os.tmpdir(), "ck-test-archive");
const mockKit = AVAILABLE_KITS.engineer;

describe("archive format validation", () => {
	beforeEach(async () => {
		await fs.promises.mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
	});

	it("should reject unsupported formats (.exe)", async () => {
		const badArchive = path.join(TEST_DIR, "malware.exe");
		await fs.promises.writeFile(badArchive, "fake content");

		await expect(
			downloadAndExtract({
				kit: mockKit,
				archive: badArchive,
			}),
		).rejects.toThrow(/Unsupported archive format/);
	});

	it("should reject files with no extension", async () => {
		const noExt = path.join(TEST_DIR, "archive");
		await fs.promises.writeFile(noExt, "fake content");

		await expect(
			downloadAndExtract({
				kit: mockKit,
				archive: noExt,
			}),
		).rejects.toThrow(/Unsupported archive format/);
	});

	it("should accept .zip format", async () => {
		// Test that validation passes for valid format
		// (actual extraction may fail due to invalid content, but format check passes)
		const zipFile = path.join(TEST_DIR, "valid.zip");
		await fs.promises.writeFile(zipFile, "PK"); // Minimal zip header

		// Should fail with extraction error, not format error
		await expect(
			downloadAndExtract({
				kit: mockKit,
				archive: zipFile,
			}),
		).rejects.not.toThrow(/Unsupported archive format/);
	});

	it("should accept .tar.gz format", async () => {
		const tarGz = path.join(TEST_DIR, "valid.tar.gz");
		await fs.promises.writeFile(tarGz, Buffer.from([0x1f, 0x8b])); // gzip magic

		await expect(
			downloadAndExtract({
				kit: mockKit,
				archive: tarGz,
			}),
		).rejects.not.toThrow(/Unsupported archive format/);
	});
});
