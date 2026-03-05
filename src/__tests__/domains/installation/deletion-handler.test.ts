import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleDeletions } from "@/domains/installation/deletion-handler.js";
import type { ClaudeKitMetadata, Metadata } from "@/types";

describe("deletion-handler", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`ck-deletion-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("handleDeletions", () => {
		test("deletes CK-owned files", async () => {
			// Setup: create file and metadata
			mkdirSync(join(testDir, "commands"), { recursive: true });
			const filePath = join(testDir, "commands", "old.md");
			writeFileSync(filePath, "content");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/old.md",
								checksum: "a".repeat(64),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			writeFileSync(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/old.md"],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			expect(result.deletedPaths).toContain("commands/old.md");
			expect(existsSync(filePath)).toBe(false);
		});

		test("deletes CK-modified files", async () => {
			mkdirSync(join(testDir, "commands"), { recursive: true });
			const filePath = join(testDir, "commands", "modified.md");
			writeFileSync(filePath, "modified content");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/modified.md",
								checksum: "b".repeat(64),
								ownership: "ck-modified",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			writeFileSync(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/modified.md"],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			expect(result.deletedPaths).toContain("commands/modified.md");
			expect(existsSync(filePath)).toBe(false);
		});

		test("preserves user-owned files", async () => {
			mkdirSync(join(testDir, "commands"), { recursive: true });
			const filePath = join(testDir, "commands", "custom.md");
			writeFileSync(filePath, "user content");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/custom.md",
								checksum: "c".repeat(64),
								ownership: "user",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			writeFileSync(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/custom.md"],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			expect(result.preservedPaths).toContain("commands/custom.md");
			expect(existsSync(filePath)).toBe(true);
		});

		test("prevents path traversal", async () => {
			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["../../../etc/passwd", "commands/../../../secret"],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.deletedPaths.length).toBe(0);
		});

		test("deletes directories recursively", async () => {
			mkdirSync(join(testDir, "commands", "old", "nested"), { recursive: true });
			writeFileSync(join(testDir, "commands", "old", "file.md"), "content");
			writeFileSync(join(testDir, "commands", "old", "nested", "deep.md"), "content");

			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/old"],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			expect(result.deletedPaths).toContain("commands/old");
			expect(existsSync(join(testDir, "commands", "old"))).toBe(false);
		});

		test("handles empty deletions array", async () => {
			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: [],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			expect(result.deletedPaths.length).toBe(0);
			expect(result.preservedPaths.length).toBe(0);
			expect(result.errors.length).toBe(0);
		});

		test("handles missing deletions field", async () => {
			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			expect(result.deletedPaths.length).toBe(0);
		});

		test("handles non-existent paths gracefully", async () => {
			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/does-not-exist.md"],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			// Should not error or add to deleted (file doesn't exist)
			expect(result.deletedPaths).not.toContain("commands/does-not-exist.md");
			expect(result.errors.length).toBe(0);
		});

		test("updates metadata after deletion", async () => {
			mkdirSync(join(testDir, "commands"), { recursive: true });
			writeFileSync(join(testDir, "commands", "old.md"), "content");
			writeFileSync(join(testDir, "commands", "keep.md"), "keep");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/old.md",
								checksum: "a".repeat(64),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "commands/keep.md",
								checksum: "b".repeat(64),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};
			writeFileSync(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/old.md"],
			};

			await handleDeletions(sourceMetadata, testDir);

			// Read updated metadata
			const updatedContent = Bun.file(join(testDir, "metadata.json")).text();
			const updatedMetadata: Metadata = JSON.parse(await updatedContent);

			// old.md should be removed from metadata
			const files = updatedMetadata.kits?.engineer?.files || [];
			expect(files.find((f) => f.path === "commands/old.md")).toBeUndefined();
			// keep.md should still be there
			expect(files.find((f) => f.path === "commands/keep.md")).toBeDefined();
		});

		test("cleans up empty parent directories", async () => {
			mkdirSync(join(testDir, "commands", "nested"), { recursive: true });
			writeFileSync(join(testDir, "commands", "nested", "file.md"), "content");

			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/nested/file.md"],
			};

			await handleDeletions(sourceMetadata, testDir);

			// File should be deleted
			expect(existsSync(join(testDir, "commands", "nested", "file.md"))).toBe(false);
			// Empty nested directory should be cleaned up
			expect(existsSync(join(testDir, "commands", "nested"))).toBe(false);
			// Parent commands should still exist if it has other content
		});

		test("deletes untracked files (not in metadata)", async () => {
			mkdirSync(join(testDir, "commands"), { recursive: true });
			writeFileSync(join(testDir, "commands", "untracked.md"), "content");

			// Empty metadata (no files tracked)
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [],
					},
				},
			};
			writeFileSync(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const sourceMetadata: ClaudeKitMetadata = {
				version: "2.0.0",
				name: "test",
				description: "test",
				deletions: ["commands/untracked.md"],
			};

			const result = await handleDeletions(sourceMetadata, testDir);

			// Untracked files should be deleted (assumed CK-owned)
			expect(result.deletedPaths).toContain("commands/untracked.md");
			expect(existsSync(join(testDir, "commands", "untracked.md"))).toBe(false);
		});
	});
});
