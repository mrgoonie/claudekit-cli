/**
 * Tests for prefix-cleaner.ts
 *
 * Covers:
 * - Kit-aware cleanup (only removes files from specified kit)
 * - Preserving files from other kits
 * - Backward compatibility (no kitType provided)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupCommandsDirectory } from "@/services/transformers/commands-prefix/prefix-cleaner.js";
import type { Metadata } from "@/types";
import { pathExists, remove } from "fs-extra";

describe("cleanupCommandsDirectory - kit-aware", () => {
	let tempDir: string;
	let claudeDir: string;
	let commandsDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "prefix-cleaner-test-"));
		claudeDir = join(tempDir, ".claude");
		commandsDir = join(claudeDir, "commands");
		await mkdir(commandsDir, { recursive: true });
	});

	afterEach(async () => {
		if (await pathExists(tempDir)) {
			await remove(tempDir);
		}
	});

	describe("kit-specific cleanup", () => {
		it("only removes files owned by specified kit", async () => {
			// Setup: create files owned by different kits
			const ckDir = join(commandsDir, "ck");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(ckDir, { recursive: true });
			await mkdir(mktDir, { recursive: true });

			const planPath = join(ckDir, "plan.md");
			const emailPath = join(mktDir, "email.md");
			await writeFile(planPath, "# Plan command");
			await writeFile(emailPath, "# Email command");

			// Create metadata with both kits
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/ck/plan.md",
								checksum: await calculateChecksum(planPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
					marketing: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/mkt/email.md",
								checksum: await calculateChecksum(emailPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};

			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Cleanup engineer kit only
			const result = await cleanupCommandsDirectory(tempDir, false, {
				kitType: "engineer",
			});

			// Engineer file should be deleted
			const planExists = await pathExists(planPath);
			expect(planExists).toBe(false);

			// Marketing file should be preserved
			const emailExists = await pathExists(emailPath);
			expect(emailExists).toBe(true);

			// Verify counts
			expect(result.deletedCount).toBe(1);
			expect(result.preservedCount).toBe(0);
		});

		it("preserves all files from other kits", async () => {
			// Setup: multiple files per kit
			const ckDir = join(commandsDir, "ck");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(ckDir, { recursive: true });
			await mkdir(mktDir, { recursive: true });

			const planPath = join(ckDir, "plan.md");
			const fixPath = join(ckDir, "fix.md");
			const emailPath = join(mktDir, "email.md");
			const campaignPath = join(mktDir, "campaign.md");

			await writeFile(planPath, "# Plan");
			await writeFile(fixPath, "# Fix");
			await writeFile(emailPath, "# Email");
			await writeFile(campaignPath, "# Campaign");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/ck/plan.md",
								checksum: await calculateChecksum(planPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "commands/ck/fix.md",
								checksum: await calculateChecksum(fixPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
					marketing: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/mkt/email.md",
								checksum: await calculateChecksum(emailPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
							{
								path: "commands/mkt/campaign.md",
								checksum: await calculateChecksum(campaignPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};

			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Cleanup marketing kit only
			const result = await cleanupCommandsDirectory(tempDir, false, {
				kitType: "marketing",
			});

			// Marketing files deleted
			expect(await pathExists(emailPath)).toBe(false);
			expect(await pathExists(campaignPath)).toBe(false);

			// Engineer files preserved
			expect(await pathExists(planPath)).toBe(true);
			expect(await pathExists(fixPath)).toBe(true);

			expect(result.deletedCount).toBe(2);
		});
	});

	describe("backward compatibility", () => {
		it("cleans all kits when no kitType provided", async () => {
			// Setup: files from multiple kits
			const ckDir = join(commandsDir, "ck");
			const mktDir = join(commandsDir, "mkt");
			await mkdir(ckDir, { recursive: true });
			await mkdir(mktDir, { recursive: true });

			const planPath = join(ckDir, "plan.md");
			const emailPath = join(mktDir, "email.md");
			await writeFile(planPath, "# Plan");
			await writeFile(emailPath, "# Email");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/ck/plan.md",
								checksum: await calculateChecksum(planPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
					marketing: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/mkt/email.md",
								checksum: await calculateChecksum(emailPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};

			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Cleanup without kitType (backward compat)
			const result = await cleanupCommandsDirectory(tempDir, false, {});

			// Both files should be deleted
			expect(await pathExists(planPath)).toBe(false);
			expect(await pathExists(emailPath)).toBe(false);

			expect(result.deletedCount).toBe(2);
		});

		it("works with legacy metadata format", async () => {
			// Setup: single file
			await writeFile(join(commandsDir, "plan.md"), "# Plan");

			const planPath = join(commandsDir, "plan.md");
			const metadata: Metadata = {
				name: "ClaudeKit Engineer",
				version: "1.0.0",
				installedAt: new Date().toISOString(),
				files: [
					{
						path: "commands/plan.md",
						checksum: await calculateChecksum(planPath),
						ownership: "ck",
						installedVersion: "1.0.0",
					},
				],
			};

			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			// Cleanup with kitType on legacy format
			const result = await cleanupCommandsDirectory(tempDir, false, {
				kitType: "engineer",
			});

			// File should be deleted
			expect(await pathExists(planPath)).toBe(false);
			expect(result.deletedCount).toBe(1);
		});
	});

	describe("edge cases", () => {
		it("handles no metadata gracefully", async () => {
			await writeFile(join(commandsDir, "plan.md"), "# Plan");

			const result = await cleanupCommandsDirectory(tempDir, false, {
				kitType: "engineer",
			});

			// No cleanup should happen
			expect(result.deletedCount).toBe(0);
			expect(await pathExists(join(commandsDir, "plan.md"))).toBe(true);
		});

		it("handles empty kit metadata", async () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [],
					},
				},
			};

			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));
			await writeFile(join(commandsDir, "plan.md"), "# Plan");

			const result = await cleanupCommandsDirectory(tempDir, false, {
				kitType: "engineer",
			});

			// No files tracked = no cleanup
			expect(result.deletedCount).toBe(0);
		});

		it("preserves user-modified files even with kitType", async () => {
			const planPath = join(commandsDir, "plan.md");
			await writeFile(planPath, "# Plan - MODIFIED");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/plan.md",
								checksum: "0000000000000000000000000000000000000000000000000000000000000000",
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};

			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await cleanupCommandsDirectory(tempDir, false, {
				kitType: "engineer",
			});

			// Modified file preserved
			expect(await pathExists(planPath)).toBe(true);
			expect(result.deletedCount).toBe(0);
			expect(result.preservedCount).toBe(1);
		});
	});

	describe("dry-run mode", () => {
		it("reports what would be deleted without deleting", async () => {
			const planPath = join(commandsDir, "plan.md");
			await writeFile(planPath, "# Plan");

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: new Date().toISOString(),
						files: [
							{
								path: "commands/plan.md",
								checksum: await calculateChecksum(planPath),
								ownership: "ck",
								installedVersion: "1.0.0",
							},
						],
					},
				},
			};

			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata, null, 2));

			const result = await cleanupCommandsDirectory(tempDir, false, {
				kitType: "engineer",
				dryRun: true,
			});

			// File still exists
			expect(await pathExists(planPath)).toBe(true);

			// But reports it would be deleted
			expect(result.deletedCount).toBe(1);
			expect(result.wasDryRun).toBe(true);
		});
	});
});

/**
 * Helper: calculate SHA-256 checksum for test files
 */
async function calculateChecksum(filePath: string): Promise<string> {
	const { createHash } = await import("node:crypto");
	const { createReadStream } = await import("node:fs");

	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const stream = createReadStream(filePath);

		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
		stream.on("error", reject);
	});
}
