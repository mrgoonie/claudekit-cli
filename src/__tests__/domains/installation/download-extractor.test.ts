import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import { downloadAndExtract } from "@/domains/installation/download-extractor.js";
import {
	getHomeDirPrefix,
	transformPathsForGlobalInstall,
} from "@/services/transformers/global-path-transformer.js";
import { AVAILABLE_KITS } from "@/types";
import * as tar from "tar";

const TEST_DIR = path.join(os.tmpdir(), "ck-test-offline");
const mockKit = AVAILABLE_KITS.engineer;

async function createWrappedSourceLayoutKit(baseDir: string, wrapperName: string): Promise<string> {
	const wrapperDir = path.join(baseDir, wrapperName);
	await fs.promises.mkdir(path.join(wrapperDir, "claude", "agents"), { recursive: true });
	await fs.promises.mkdir(path.join(wrapperDir, "claude", "skills", "demo"), { recursive: true });
	await fs.promises.writeFile(
		path.join(wrapperDir, "package.json"),
		JSON.stringify({
			claudekit: {
				sourceDir: "claude",
				runtimeDir: ".claude",
			},
		}),
	);
	await fs.promises.writeFile(path.join(wrapperDir, "CLAUDE.md"), "# Kit");
	await fs.promises.writeFile(
		path.join(wrapperDir, "claude", "agents", "planner.md"),
		'node .claude/scripts/set-active-plan.cjs "plans/demo"',
	);
	await fs.promises.writeFile(
		path.join(wrapperDir, "claude", "skills", "demo", "SKILL.md"),
		"# Demo skill",
	);

	return wrapperDir;
}

describe("downloadAndExtract - offline options", () => {
	const tempDirsToCleanup: string[] = [];

	beforeEach(async () => {
		await fs.promises.mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		for (const tempDir of tempDirsToCleanup.splice(0)) {
			await fs.promises.rm(tempDir, { recursive: true, force: true });
		}
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

			tempDirsToCleanup.push(result.tempDir);
			expect(result.extractDir).toBe(path.resolve(kitDir));
			expect(result.archivePath).toBe("");
		});

		test("should materialize claude source layout back to runtime .claude", async () => {
			const kitDir = path.join(TEST_DIR, "source-layout-kit");
			await fs.promises.mkdir(path.join(kitDir, "claude", "skills", "demo"), {
				recursive: true,
			});
			await fs.promises.writeFile(
				path.join(kitDir, "package.json"),
				JSON.stringify({
					claudekit: {
						sourceDir: "claude",
						runtimeDir: ".claude",
					},
				}),
			);
			await fs.promises.writeFile(path.join(kitDir, "CLAUDE.md"), "# Kit");
			await fs.promises.writeFile(
				path.join(kitDir, "claude", "skills", "demo", "SKILL.md"),
				"# Demo skill",
			);

			const result = await downloadAndExtract({
				kit: mockKit,
				kitPath: kitDir,
			});

			tempDirsToCleanup.push(result.tempDir);
			expect(result.extractDir).not.toBe(path.resolve(kitDir));
			await expect(
				fs.promises.stat(path.join(result.extractDir, ".claude", "skills", "demo", "SKILL.md")),
			).resolves.toBeDefined();
			await expect(fs.promises.stat(path.join(result.extractDir, "claude"))).rejects.toMatchObject({
				code: "ENOENT",
			});
		});

		test("should resolve wrapped local repo directories before materializing runtime layout", async () => {
			const downloadDir = path.join(TEST_DIR, "downloaded-kit");
			await fs.promises.mkdir(downloadDir, { recursive: true });
			await createWrappedSourceLayoutKit(downloadDir, "claudekit-engineer-main");

			const result = await downloadAndExtract({
				kit: mockKit,
				kitPath: downloadDir,
			});

			tempDirsToCleanup.push(result.tempDir);
			expect(result.extractDir).not.toBe(path.resolve(downloadDir));
			await expect(
				fs.promises.stat(path.join(result.extractDir, ".claude", "skills", "demo", "SKILL.md")),
			).resolves.toBeDefined();
			await expect(
				fs.promises.stat(path.join(result.extractDir, ".claude", "agents", "planner.md")),
			).resolves.toBeDefined();
		});

		test("should ignore top-level metadata noise when resolving wrapped local repo directories", async () => {
			const downloadDir = path.join(TEST_DIR, "downloaded-kit-with-noise");
			await fs.promises.mkdir(downloadDir, { recursive: true });
			await createWrappedSourceLayoutKit(downloadDir, "claudekit-engineer-main");
			await fs.promises.writeFile(path.join(downloadDir, "._claudekit-engineer-main"), "noise");
			await fs.promises.writeFile(path.join(downloadDir, "Thumbs.db"), "noise");

			const result = await downloadAndExtract({
				kit: mockKit,
				kitPath: downloadDir,
			});

			tempDirsToCleanup.push(result.tempDir);
			expect(result.extractDir).not.toBe(path.resolve(downloadDir));
			await expect(
				fs.promises.stat(path.join(result.extractDir, ".claude", "skills", "demo", "SKILL.md")),
			).resolves.toBeDefined();
			await expect(fs.promises.stat(path.join(result.extractDir, "claude"))).rejects.toMatchObject({
				code: "ENOENT",
			});
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
		test("should resolve wrapped repo archives and keep global path transforms working", async () => {
			const archiveSourceDir = path.join(TEST_DIR, "archive-source");
			await fs.promises.mkdir(archiveSourceDir, { recursive: true });
			const wrapperName = "claudekit-engineer-main";
			await createWrappedSourceLayoutKit(archiveSourceDir, wrapperName);

			const archivePath = path.join(TEST_DIR, "claudekit-engineer-main.tar.gz");
			await tar.create(
				{
					cwd: archiveSourceDir,
					file: archivePath,
					gzip: true,
				},
				[wrapperName],
			);

			const result = await downloadAndExtract({
				kit: mockKit,
				archive: archivePath,
			});

			tempDirsToCleanup.push(result.tempDir);
			await expect(
				fs.promises.stat(path.join(result.extractDir, ".claude", "skills", "demo", "SKILL.md")),
			).resolves.toBeDefined();
			await expect(fs.promises.stat(path.join(result.extractDir, "claude"))).rejects.toMatchObject({
				code: "ENOENT",
			});

			await transformPathsForGlobalInstall(result.extractDir);
			const plannerContent = await fs.promises.readFile(
				path.join(result.extractDir, ".claude", "agents", "planner.md"),
				"utf-8",
			);
			expect(plannerContent).toContain(`${getHomeDirPrefix()}/.claude/scripts/set-active-plan.cjs`);
		});

		test("should ignore top-level metadata noise when resolving wrapped repo archives", async () => {
			const archiveSourceDir = path.join(TEST_DIR, "archive-source-with-noise");
			await fs.promises.mkdir(archiveSourceDir, { recursive: true });
			const wrapperName = "claudekit-engineer-main";
			await createWrappedSourceLayoutKit(archiveSourceDir, wrapperName);
			await fs.promises.writeFile(
				path.join(archiveSourceDir, "._claudekit-engineer-main"),
				"noise",
			);
			await fs.promises.writeFile(path.join(archiveSourceDir, "desktop.ini"), "noise");

			const archivePath = path.join(TEST_DIR, "claudekit-engineer-main-with-noise.tar.gz");
			await tar.create(
				{
					cwd: archiveSourceDir,
					file: archivePath,
					gzip: true,
				},
				["._claudekit-engineer-main", "desktop.ini", wrapperName],
			);

			const result = await downloadAndExtract({
				kit: mockKit,
				archive: archivePath,
			});

			tempDirsToCleanup.push(result.tempDir);
			await expect(
				fs.promises.stat(path.join(result.extractDir, ".claude", "skills", "demo", "SKILL.md")),
			).resolves.toBeDefined();
			await expect(fs.promises.stat(path.join(result.extractDir, "claude"))).rejects.toMatchObject({
				code: "ENOENT",
			});
		});

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
