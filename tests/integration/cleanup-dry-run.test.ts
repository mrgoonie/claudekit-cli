import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";
import { CommandsPrefix } from "@/services/transformers/commands-prefix.js";
import type { Metadata } from "@/types";
import { pathExists } from "fs-extra";

describe("Cleanup Dry-Run Mode", () => {
	let tempDir: string;
	let claudeDir: string;
	let commandsDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-dryrun-test-${Date.now()}`);
		claudeDir = join(tempDir, ".claude");
		commandsDir = join(claudeDir, "commands");
		await mkdir(commandsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("dry-run mode does not delete files", async () => {
		// Create CK file
		const ckFile = join(commandsDir, "plan.md");
		await writeFile(ckFile, "# Plan");
		const checksum = await OwnershipChecker.calculateChecksum(ckFile);

		// Create metadata
		const metadata: Metadata = {
			name: "test-kit",
			version: "1.0.0",
			installedAt: new Date().toISOString(),
			scope: "local",
			files: [
				{
					path: "commands/plan.md",
					checksum,
					ownership: "ck",
					installedVersion: "1.0.0",
				},
			],
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

		// Run cleanup in dry-run mode
		const result = await CommandsPrefix.cleanupCommandsDirectory(tempDir, false, {
			dryRun: true,
		});

		// Verify file still exists
		const exists = await pathExists(ckFile);
		expect(exists).toBe(true);

		// Verify result indicates what would happen
		expect(result.wasDryRun).toBe(true);
		expect(result.deletedCount).toBe(1); // Would delete 1
		expect(result.preservedCount).toBe(0);
		expect(result.results).toHaveLength(1);
		expect(result.results[0].action).toBe("delete");
	});

	test("dry-run returns correct results for mixed files", async () => {
		// Create CK file
		const ckFile = join(commandsDir, "plan.md");
		await writeFile(ckFile, "# Plan");
		const ckChecksum = await OwnershipChecker.calculateChecksum(ckFile);

		// Create user file (not in metadata)
		const userFile = join(commandsDir, "custom.md");
		await writeFile(userFile, "# Custom");

		// Create modified file (checksum mismatch)
		const modifiedFile = join(commandsDir, "fix.md");
		await writeFile(modifiedFile, "original");
		const originalChecksum = await OwnershipChecker.calculateChecksum(modifiedFile);
		await writeFile(modifiedFile, "modified by user");

		// Create metadata
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
				{
					path: "commands/fix.md",
					checksum: originalChecksum,
					ownership: "ck",
					installedVersion: "1.0.0",
				},
			],
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

		// Run dry-run
		const result = await CommandsPrefix.cleanupCommandsDirectory(tempDir, false, {
			dryRun: true,
		});

		// All files should still exist
		expect(await pathExists(ckFile)).toBe(true);
		expect(await pathExists(userFile)).toBe(true);
		expect(await pathExists(modifiedFile)).toBe(true);

		// Verify results
		expect(result.wasDryRun).toBe(true);
		expect(result.deletedCount).toBe(1); // Only plan.md would be deleted
		expect(result.preservedCount).toBe(2); // custom.md and fix.md preserved

		// Check individual results
		const deleteResults = result.results.filter((r) => r.action === "delete");
		const preserveResults = result.results.filter((r) => r.action === "preserve");

		expect(deleteResults).toHaveLength(1);
		expect(preserveResults).toHaveLength(2);
	});

	test("force-overwrite deletes modified files", async () => {
		// Create modified file
		const modifiedFile = join(commandsDir, "plan.md");
		await writeFile(modifiedFile, "original");
		const originalChecksum = await OwnershipChecker.calculateChecksum(modifiedFile);
		await writeFile(modifiedFile, "modified by user");

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

		// Run cleanup with force-overwrite
		const result = await CommandsPrefix.cleanupCommandsDirectory(tempDir, false, {
			forceOverwrite: true,
		});

		// Verify file deleted
		const exists = await pathExists(modifiedFile);
		expect(exists).toBe(false);

		// Verify result
		expect(result.wasDryRun).toBe(false);
		expect(result.deletedCount).toBe(1);
		expect(result.preservedCount).toBe(0);
	});

	test("force-overwrite with dry-run previews deletion", async () => {
		// Create modified file
		const modifiedFile = join(commandsDir, "plan.md");
		await writeFile(modifiedFile, "original");
		const originalChecksum = await OwnershipChecker.calculateChecksum(modifiedFile);
		await writeFile(modifiedFile, "modified by user");

		// Create metadata
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

		// Run with both dry-run and force-overwrite
		const result = await CommandsPrefix.cleanupCommandsDirectory(tempDir, false, {
			dryRun: true,
			forceOverwrite: true,
		});

		// File should still exist (dry-run)
		const exists = await pathExists(modifiedFile);
		expect(exists).toBe(true);

		// But result should show it would be deleted
		expect(result.wasDryRun).toBe(true);
		expect(result.deletedCount).toBe(1);
		expect(result.results[0].action).toBe("delete");
		expect(result.results[0].reason).toBe("force overwrite");
	});
});
