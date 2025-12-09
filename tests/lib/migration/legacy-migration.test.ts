import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LegacyMigration } from "@/domains/migration/legacy-migration.js";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";

describe("LegacyMigration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-migration-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("detectLegacy", () => {
		test("detects no-metadata case", async () => {
			const result = await LegacyMigration.detectLegacy(tempDir);

			expect(result.isLegacy).toBe(true);
			expect(result.reason).toBe("no-metadata");
			expect(result.confidence).toBe("high");
		});

		test("detects old-format case (metadata without files[])", async () => {
			// Create old format metadata
			await writeFile(
				join(tempDir, "metadata.json"),
				JSON.stringify({ version: "1.0.0", installedFiles: ["commands/"] }),
			);

			const result = await LegacyMigration.detectLegacy(tempDir);

			expect(result.isLegacy).toBe(true);
			expect(result.reason).toBe("old-format");
		});

		test("detects current format (has files[])", async () => {
			// Create current format metadata
			await writeFile(
				join(tempDir, "metadata.json"),
				JSON.stringify({
					version: "1.0.0",
					files: [
						{
							path: "commands/plan.md",
							checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd",
							ownership: "ck",
							installedVersion: "1.0.0",
						},
					],
				}),
			);

			const result = await LegacyMigration.detectLegacy(tempDir);

			expect(result.isLegacy).toBe(false);
			expect(result.reason).toBe("current");
		});
	});

	describe("scanFiles", () => {
		test("collects all files recursively", async () => {
			// Create nested structure
			await mkdir(join(tempDir, "commands"), { recursive: true });
			await writeFile(join(tempDir, "test.txt"), "root file");
			await writeFile(join(tempDir, "commands", "plan.md"), "plan content");

			const files = await LegacyMigration.scanFiles(tempDir);

			expect(files.length).toBe(2);
			expect(files.some((f) => f.endsWith("test.txt"))).toBe(true);
			expect(files.some((f) => f.endsWith("plan.md"))).toBe(true);
		});

		test("excludes metadata.json", async () => {
			await writeFile(join(tempDir, "metadata.json"), "{}");
			await writeFile(join(tempDir, "test.txt"), "content");

			const files = await LegacyMigration.scanFiles(tempDir);

			expect(files.length).toBe(1);
			expect(files[0]).toContain("test.txt");
		});
	});

	describe("classifyFiles", () => {
		test("classifies pristine CK file", async () => {
			const testFile = join(tempDir, "test.txt");
			await writeFile(testFile, "content");
			const checksum = await OwnershipChecker.calculateChecksum(testFile);

			const manifest = {
				version: "1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "test.txt", checksum, size: 7 }],
			};

			const preview = await LegacyMigration.classifyFiles(tempDir, manifest);

			expect(preview.ckPristine).toContain("test.txt");
			expect(preview.ckModified).toHaveLength(0);
			expect(preview.userCreated).toHaveLength(0);
		});

		test("classifies modified CK file", async () => {
			const testFile = join(tempDir, "test.txt");
			await writeFile(testFile, "modified content");

			const manifest = {
				version: "1.0.0",
				generatedAt: new Date().toISOString(),
				files: [
					{
						path: "test.txt",
						checksum: "different123different123different123different123different123diff",
						size: 7,
					},
				],
			};

			const preview = await LegacyMigration.classifyFiles(tempDir, manifest);

			expect(preview.ckModified).toContain("test.txt");
			expect(preview.ckPristine).toHaveLength(0);
		});

		test("classifies user-created file", async () => {
			const testFile = join(tempDir, "custom.txt");
			await writeFile(testFile, "user content");

			const manifest = {
				version: "1.0.0",
				generatedAt: new Date().toISOString(),
				files: [],
			};

			const preview = await LegacyMigration.classifyFiles(tempDir, manifest);

			expect(preview.userCreated).toContain("custom.txt");
		});
	});

	describe("migrate", () => {
		test("creates metadata with tracked files", async () => {
			const testFile = join(tempDir, "test.txt");
			await writeFile(testFile, "content");
			const checksum = await OwnershipChecker.calculateChecksum(testFile);

			const manifest = {
				version: "1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "test.txt", checksum, size: 7 }],
			};

			await LegacyMigration.migrate(tempDir, manifest, "test-kit", "1.0.0", false);

			const metadata = await ManifestWriter.readManifest(tempDir);
			expect(metadata).not.toBeNull();
			expect(metadata?.files).toHaveLength(1);
			expect(metadata?.files?.[0].ownership).toBe("ck");
		});

		test("preserves user files during migration", async () => {
			// Create CK file and user file
			const ckFile = join(tempDir, "ck-file.txt");
			const userFile = join(tempDir, "user-file.txt");
			await writeFile(ckFile, "ck content");
			await writeFile(userFile, "user content");

			const ckChecksum = await OwnershipChecker.calculateChecksum(ckFile);

			const manifest = {
				version: "1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "ck-file.txt", checksum: ckChecksum, size: 10 }],
			};

			await LegacyMigration.migrate(tempDir, manifest, "test-kit", "1.0.0", false);

			const metadata = await ManifestWriter.readManifest(tempDir);
			expect(metadata?.files).toHaveLength(2);

			const ckTracked = metadata?.files?.find((f) => f.path === "ck-file.txt");
			const userTracked = metadata?.files?.find((f) => f.path === "user-file.txt");

			expect(ckTracked?.ownership).toBe("ck");
			expect(userTracked?.ownership).toBe("user");
		});
	});
});
