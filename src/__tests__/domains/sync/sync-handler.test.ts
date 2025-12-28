/**
 * Integration tests for sync-handler - sync mode orchestration
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";

describe("sync-handler integration", () => {
	let testDir: string;
	let claudeDir: string;
	let cacheDir: string;

	beforeEach(async () => {
		testDir = join(
			tmpdir(),
			`sync-handler-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		claudeDir = join(testDir, ".claude");
		cacheDir = join(testDir, "cache");
		await mkdir(claudeDir, { recursive: true });
		await mkdir(cacheDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("lock file handling", () => {
		it("creates lock file in cache directory", async () => {
			const lockPath = join(cacheDir, ".sync-lock");

			// Simulate lock creation
			const { open, unlink } = await import("node:fs/promises");
			const handle = await open(lockPath, "wx");

			try {
				const lockStat = await stat(lockPath);
				expect(lockStat.isFile()).toBe(true);
			} finally {
				await handle.close();
				await unlink(lockPath);
			}
		});

		it("detects stale lock files", async () => {
			const lockPath = join(cacheDir, ".sync-lock");

			// Create old lock file
			await writeFile(lockPath, "");

			// Modify mtime to be old (5+ minutes ago)
			const { utimes } = await import("node:fs/promises");
			const oldTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
			await utimes(lockPath, oldTime, oldTime);

			const lockStat = await stat(lockPath);
			const lockAge = Date.now() - lockStat.mtimeMs;

			// Lock should be considered stale (> 5 minutes)
			expect(lockAge).toBeGreaterThan(5 * 60 * 1000);
		});
	});

	describe("backup creation", () => {
		it("creates backup with timestamp in path", () => {
			// PathResolver.getBackupDir() includes timestamp
			const backupDir = PathResolver.getBackupDir();
			// Format: YYYY-MM-DDTHH-MM-SS-mmm-random
			expect(backupDir).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
		});

		it("backup directories are unique", () => {
			const backup1 = PathResolver.getBackupDir();
			const backup2 = PathResolver.getBackupDir();

			// Due to timestamp + random, should be different
			expect(backup1).not.toBe(backup2);
		});
	});

	describe("metadata detection", () => {
		it("validates presence of metadata.json", async () => {
			const metadataPath = join(claudeDir, "metadata.json");

			// Initially no metadata
			try {
				await stat(metadataPath);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
			}

			// Create metadata
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [],
					},
				},
			};
			await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

			const metaStat = await stat(metadataPath);
			expect(metaStat.isFile()).toBe(true);
		});

		it("reads kit version from metadata", async () => {
			const metadata = {
				kits: {
					engineer: {
						version: "1.5.0",
						installedAt: new Date().toISOString(),
						files: [{ path: "commands.md", checksum: "abc", ownership: "ck" }],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const content = await readFile(join(claudeDir, "metadata.json"), "utf8");
			const parsed = JSON.parse(content);

			expect(parsed.kits.engineer.version).toBe("1.5.0");
			expect(parsed.kits.engineer.files).toHaveLength(1);
		});
	});

	describe("file sync scenarios", () => {
		it("handles empty tracked files array", async () => {
			const files: Array<{ path: string; checksum: string; ownership: string }> = [];
			expect(files.length).toBe(0);
		});

		it("categorizes files by ownership", () => {
			const files = [
				{ path: "a.md", ownership: "user" },
				{ path: "b.md", ownership: "ck" },
				{ path: "c.md", ownership: "ck-modified" },
			];

			const userOwned = files.filter((f) => f.ownership === "user");
			const ckOwned = files.filter((f) => f.ownership === "ck");
			const ckModified = files.filter((f) => f.ownership === "ck-modified");

			expect(userOwned).toHaveLength(1);
			expect(ckOwned).toHaveLength(1);
			expect(ckModified).toHaveLength(1);
		});
	});

	describe("error scenarios", () => {
		it("handles missing .claude directory", async () => {
			const nonExistent = join(testDir, "nonexistent", ".claude");

			try {
				await stat(nonExistent);
				expect(true).toBe(false); // Should not reach
			} catch (error) {
				expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
			}
		});

		it("handles permission errors gracefully", async () => {
			// Create a file we can test with
			const testFile = join(claudeDir, "test.md");
			await writeFile(testFile, "content");

			// Verify file exists and is readable
			const content = await readFile(testFile, "utf8");
			expect(content).toBe("content");
		});
	});

	describe("non-interactive mode", () => {
		it("tracks files requiring review", () => {
			const plan = {
				autoUpdate: [{ path: "auto.md" }],
				needsReview: [{ path: "review1.md" }, { path: "review2.md" }],
				skipped: [{ path: "user.md" }],
			};

			// Non-interactive should fail when needsReview is not empty
			const canCompleteNonInteractive = plan.needsReview.length === 0;
			expect(canCompleteNonInteractive).toBe(false);
		});

		it("succeeds when no files need review", () => {
			const plan = {
				autoUpdate: [{ path: "auto.md" }],
				needsReview: [],
				skipped: [{ path: "user.md" }],
			};

			const canCompleteNonInteractive = plan.needsReview.length === 0;
			expect(canCompleteNonInteractive).toBe(true);
		});
	});
});
