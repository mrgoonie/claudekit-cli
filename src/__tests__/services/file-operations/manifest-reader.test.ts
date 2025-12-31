import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findFileInInstalledKits } from "@/services/file-operations/manifest/manifest-reader.js";

describe("findFileInInstalledKits", () => {
	let testDir: string;
	let claudeDir: string;

	beforeEach(async () => {
		testDir = await new Promise<string>((resolve) => {
			const dir = join(tmpdir(), `ck-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
			resolve(dir);
		});
		claudeDir = testDir;
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("returns exists=false when no metadata.json", async () => {
		const result = await findFileInInstalledKits(claudeDir, "skills/foo.md");
		expect(result.exists).toBe(false);
		expect(result.ownerKit).toBeNull();
	});

	it("returns exists=false when file not in any kit", async () => {
		const metadata = {
			kits: {
				engineer: {
					version: "1.0.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/bar.md",
							checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
							ownership: "ck",
							installedVersion: "1.0.0",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const result = await findFileInInstalledKits(claudeDir, "skills/foo.md");
		expect(result.exists).toBe(false);
	});

	it("finds file in engineer kit", async () => {
		const checksum = "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1";
		const metadata = {
			kits: {
				engineer: {
					version: "1.0.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/foo.md",
							checksum,
							ownership: "ck",
							installedVersion: "1.0.0",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const result = await findFileInInstalledKits(claudeDir, "skills/foo.md");
		expect(result.exists).toBe(true);
		expect(result.ownerKit).toBe("engineer");
		expect(result.checksum).toBe(checksum);
	});

	it("excludes kit being installed", async () => {
		const metadata = {
			kits: {
				engineer: {
					version: "1.0.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/foo.md",
							checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
							ownership: "ck",
							installedVersion: "1.0.0",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const result = await findFileInInstalledKits(claudeDir, "skills/foo.md", "engineer");
		expect(result.exists).toBe(false); // Excluded
	});

	it("finds file across multiple kits", async () => {
		const checksum = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
		const metadata = {
			kits: {
				engineer: {
					version: "1.0.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/shared.md",
							checksum,
							ownership: "ck",
							installedVersion: "1.0.0",
						},
					],
				},
				marketing: {
					version: "2.0.0",
					installedAt: "2025-01-02T00:00:00Z",
					files: [],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const result = await findFileInInstalledKits(claudeDir, "skills/shared.md", "marketing");
		expect(result.exists).toBe(true);
		expect(result.ownerKit).toBe("engineer");
	});

	it("returns version from kit metadata", async () => {
		const checksum = "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3";
		const metadata = {
			kits: {
				engineer: {
					version: "2.5.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/versioned.md",
							checksum,
							ownership: "ck",
							installedVersion: "2.5.0",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const result = await findFileInInstalledKits(claudeDir, "skills/versioned.md");
		expect(result.exists).toBe(true);
		expect(result.version).toBe("2.5.0");
	});
});
