import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";
import { OwnershipChecker } from "../../src/services/file-operations/ownership-checker.js";
import { CommandsPrefix } from "../../src/services/transformers/commands-prefix.js";
import type { Metadata } from "../../src/types/index.js";

describe("Ownership-Aware Operations", () => {
	let tempDir: string;
	let claudeDir: string;
	let commandsDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-test-${Date.now()}`);
		claudeDir = join(tempDir, ".claude");
		commandsDir = join(claudeDir, "commands");
		await mkdir(commandsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("cleanupCommandsDirectory", () => {
		test("deletes CK-owned pristine files", async () => {
			// Create CK file
			const ckFile = join(commandsDir, "ck-plan.md");
			await writeFile(ckFile, "# Plan");
			const checksum = await OwnershipChecker.calculateChecksum(ckFile);

			// Create metadata with ownership tracking
			const metadata: Metadata = {
				name: "test-kit",
				version: "1.0.0",
				installedAt: new Date().toISOString(),
				scope: "local",
				files: [
					{
						path: "commands/ck-plan.md",
						checksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Run cleanup
			await CommandsPrefix.cleanupCommandsDirectory(tempDir, false);

			// Verify file deleted
			const exists = await pathExists(ckFile);
			expect(exists).toBe(false);
		});

		test("preserves user-created files", async () => {
			// Create user file (not in manifest)
			const userFile = join(commandsDir, "custom.md");
			await writeFile(userFile, "# Custom");

			// Create CK file that will be deleted
			const ckFile = join(commandsDir, "plan.md");
			await writeFile(ckFile, "# Plan");
			const ckChecksum = await OwnershipChecker.calculateChecksum(ckFile);

			// Create metadata (no entry for custom.md, only for plan.md)
			const metadata: Metadata = {
				name: "test-kit",
				version: "1.0.0",
				installedAt: new Date().toISOString(),
				scope: "local",
				files: [
					{
						path: "commands/plan.md",
						checksum: ckChecksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Run cleanup
			await CommandsPrefix.cleanupCommandsDirectory(tempDir, false);

			// Verify user file preserved
			const userExists = await pathExists(userFile);
			expect(userExists).toBe(true);

			// Verify CK file deleted
			const ckExists = await pathExists(ckFile);
			expect(ckExists).toBe(false);
		});

		test("preserves CK-modified files", async () => {
			// Create file that will be modified
			const modifiedFile = join(commandsDir, "plan.md");
			await writeFile(modifiedFile, "original content");
			const originalChecksum = await OwnershipChecker.calculateChecksum(modifiedFile);

			// Modify file (simulating user edit)
			await writeFile(modifiedFile, "modified by user - DO NOT DELETE");

			// Create metadata with original checksum
			const metadata: Metadata = {
				name: "test-kit",
				version: "1.0.0",
				installedAt: new Date().toISOString(),
				scope: "local",
				files: [
					{
						path: "commands/plan.md",
						checksum: originalChecksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Run cleanup
			await CommandsPrefix.cleanupCommandsDirectory(tempDir, false);

			// Verify file preserved
			const exists = await pathExists(modifiedFile);
			expect(exists).toBe(true);

			// Verify content unchanged
			const content = await readFile(modifiedFile, "utf-8");
			expect(content).toBe("modified by user - DO NOT DELETE");
		});

		test("skips cleanup gracefully on legacy install (no metadata files[])", async () => {
			// Create file without ownership tracking metadata
			await writeFile(join(commandsDir, "test.md"), "content");

			// Create old-format metadata (no files[] field)
			const metadata = {
				name: "test-kit",
				version: "1.0.0",
				installedAt: new Date().toISOString(),
				scope: "local",
				installedFiles: ["commands/"],
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Run cleanup should succeed (skip gracefully, treating all as user-owned)
			const result = await CommandsPrefix.cleanupCommandsDirectory(tempDir, false);

			// Verify cleanup was skipped (no files deleted, no files preserved via ownership check)
			expect(result.deletedCount).toBe(0);
			expect(result.preservedCount).toBe(0);

			// Verify file still exists (preserved as user-owned by default)
			const exists = await pathExists(join(commandsDir, "test.md"));
			expect(exists).toBe(true);
		});

		test("handles nested directories correctly", async () => {
			// Create nested structure
			const nestedDir = join(commandsDir, "ck");
			await mkdir(nestedDir, { recursive: true });

			const nestedCkFile = join(nestedDir, "plan.md");
			await writeFile(nestedCkFile, "# Nested Plan");
			const nestedChecksum = await OwnershipChecker.calculateChecksum(nestedCkFile);

			const nestedUserFile = join(nestedDir, "custom.md");
			await writeFile(nestedUserFile, "# Custom");

			// Create metadata
			const metadata: Metadata = {
				name: "test-kit",
				version: "1.0.0",
				installedAt: new Date().toISOString(),
				scope: "local",
				files: [
					{
						path: "commands/ck/plan.md",
						checksum: nestedChecksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Run cleanup
			await CommandsPrefix.cleanupCommandsDirectory(tempDir, false);

			// Verify CK file deleted
			const ckExists = await pathExists(nestedCkFile);
			expect(ckExists).toBe(false);

			// Verify user file preserved
			const userExists = await pathExists(nestedUserFile);
			expect(userExists).toBe(true);
		});

		test("works in global mode", async () => {
			// Setup for global mode (claudeDir at targetDir level)
			const globalDir = join(tmpdir(), `ck-global-test-${Date.now()}`);
			const globalCommandsDir = join(globalDir, "commands");
			await mkdir(globalCommandsDir, { recursive: true });

			const ckFile = join(globalCommandsDir, "plan.md");
			await writeFile(ckFile, "# Plan");
			const checksum = await OwnershipChecker.calculateChecksum(ckFile);

			// Create metadata
			const metadata: Metadata = {
				name: "test-kit",
				version: "1.0.0",
				installedAt: new Date().toISOString(),
				scope: "global",
				files: [
					{
						path: "commands/plan.md",
						checksum,
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};
			await writeFile(join(globalDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Run cleanup in global mode
			await CommandsPrefix.cleanupCommandsDirectory(globalDir, true);

			// Verify file deleted
			const exists = await pathExists(ckFile);
			expect(exists).toBe(false);

			// Cleanup
			await rm(globalDir, { recursive: true, force: true });
		});
	});
});
