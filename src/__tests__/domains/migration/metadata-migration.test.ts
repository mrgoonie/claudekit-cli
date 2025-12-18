/**
 * Tests for multi-kit metadata migration
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	detectMetadataFormat,
	getAllTrackedFiles,
	getInstalledKits,
	getKitMetadata,
	migrateToMultiKit,
	needsMigration,
} from "@/domains/migration/metadata-migration.js";
import type { Metadata, TrackedFile } from "@/types";

describe("metadata-migration", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `metadata-migration-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("detectMetadataFormat", () => {
		it("returns 'none' when no metadata.json exists", async () => {
			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("none");
			expect(result.metadata).toBeNull();
			expect(result.detectedKit).toBeNull();
		});

		it("detects legacy format with name and version", async () => {
			const legacy: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v1.2.3",
				installedAt: "2024-01-01T00:00:00.000Z",
				scope: "local",
				files: [],
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("legacy");
			expect(result.detectedKit).toBe("engineer");
		});

		it("detects legacy format with marketing kit", async () => {
			const legacy: Metadata = {
				name: "ClaudeKit Marketing",
				version: "v0.1.0",
				installedAt: "2024-01-01T00:00:00.000Z",
				scope: "global",
				files: [],
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("legacy");
			expect(result.detectedKit).toBe("marketing");
		});

		it("defaults to engineer for unnamed legacy installs", async () => {
			const legacy: Metadata = {
				version: "v1.0.0",
				installedAt: "2024-01-01T00:00:00.000Z",
				files: [],
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("legacy");
			expect(result.detectedKit).toBe("engineer");
		});

		it("detects multi-kit format", async () => {
			const multiKit: Metadata = {
				kits: {
					engineer: {
						version: "v1.2.3",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [],
					},
				},
				scope: "local",
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(multiKit));

			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("multi-kit");
			expect(result.detectedKit).toBe("engineer");
		});

		it("detects multi-kit format with multiple kits", async () => {
			const multiKit: Metadata = {
				kits: {
					engineer: {
						version: "v1.2.3",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
					marketing: {
						version: "v0.1.0",
						installedAt: "2024-02-01T00:00:00.000Z",
					},
				},
				scope: "global",
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(multiKit));

			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("multi-kit");
		});

		it("handles empty metadata.json as 'none'", async () => {
			await writeFile(join(testDir, "metadata.json"), "{}");

			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("none");
		});

		it("handles malformed JSON", async () => {
			await writeFile(join(testDir, "metadata.json"), "{ invalid json }");

			const result = await detectMetadataFormat(testDir);
			expect(result.format).toBe("none");
		});
	});

	describe("needsMigration", () => {
		it("returns true for legacy format", async () => {
			const detection = {
				format: "legacy" as const,
				metadata: {} as Metadata,
				detectedKit: "engineer" as const,
			};
			expect(needsMigration(detection)).toBe(true);
		});

		it("returns false for multi-kit format", async () => {
			const detection = {
				format: "multi-kit" as const,
				metadata: {} as Metadata,
				detectedKit: "engineer" as const,
			};
			expect(needsMigration(detection)).toBe(false);
		});

		it("returns false for no metadata", async () => {
			const detection = { format: "none" as const, metadata: null, detectedKit: null };
			expect(needsMigration(detection)).toBe(false);
		});
	});

	describe("migrateToMultiKit", () => {
		it("migrates legacy format to multi-kit", async () => {
			const legacy: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v1.2.3",
				installedAt: "2024-01-01T00:00:00.000Z",
				scope: "local",
				files: [
					{
						path: "commands/test.md",
						checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
						ownership: "ck",
						installedVersion: "v1.2.3",
					},
				],
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			const result = await migrateToMultiKit(testDir, "engineer");

			expect(result.success).toBe(true);
			expect(result.migrated).toBe(true);
			expect(result.fromFormat).toBe("legacy");
			expect(result.toFormat).toBe("multi-kit");

			// Verify migrated structure
			const detection = await detectMetadataFormat(testDir);
			expect(detection.format).toBe("multi-kit");
			expect(detection.metadata?.kits?.engineer?.version).toBe("v1.2.3");
			expect(detection.metadata?.kits?.engineer?.files?.length).toBe(1);
		});

		it("returns success without migration for multi-kit format", async () => {
			const multiKit: Metadata = {
				kits: {
					engineer: {
						version: "v1.2.3",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
				scope: "local",
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(multiKit));

			const result = await migrateToMultiKit(testDir, "marketing");

			expect(result.success).toBe(true);
			expect(result.migrated).toBe(false);
			expect(result.fromFormat).toBe("multi-kit");
		});

		it("returns success without migration for no metadata", async () => {
			const result = await migrateToMultiKit(testDir, "engineer");

			expect(result.success).toBe(true);
			expect(result.migrated).toBe(false);
			expect(result.fromFormat).toBe("none");
		});

		it("preserves legacy fields after migration for backward compat", async () => {
			const legacy: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v1.2.3",
				installedAt: "2024-01-01T00:00:00.000Z",
				scope: "local",
				installedFiles: ["commands/test.md"],
				userConfigFiles: [".env"],
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			await migrateToMultiKit(testDir, "engineer");

			const detection = await detectMetadataFormat(testDir);
			// Legacy fields preserved for backward compat
			expect(detection.metadata?.name).toBe("ClaudeKit Engineer");
			expect(detection.metadata?.version).toBe("v1.2.3");
			expect(detection.metadata?.installedFiles).toEqual(["commands/test.md"]);
		});

		it("preserves scope during migration", async () => {
			const legacy: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v1.0.0",
				scope: "global",
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			await migrateToMultiKit(testDir, "engineer");

			const detection = await detectMetadataFormat(testDir);
			expect(detection.metadata?.scope).toBe("global");
		});
	});

	describe("getKitMetadata", () => {
		it("returns kit metadata from multi-kit structure", () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.2.3",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [],
					},
				},
			};

			const result = getKitMetadata(metadata, "engineer");
			expect(result?.version).toBe("v1.2.3");
		});

		it("returns null for non-existent kit", () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.2.3",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};

			const result = getKitMetadata(metadata, "marketing");
			expect(result).toBeNull();
		});

		it("handles legacy format as fallback", () => {
			const metadata: Metadata = {
				version: "v1.0.0",
				installedAt: "2024-01-01T00:00:00.000Z",
				files: [],
			};

			const result = getKitMetadata(metadata, "engineer");
			expect(result?.version).toBe("v1.0.0");
		});
	});

	describe("getAllTrackedFiles", () => {
		it("returns all files from multi-kit structure", () => {
			const file1: TrackedFile = {
				path: "commands/engineer.md",
				checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
				ownership: "ck",
				installedVersion: "v1.2.3",
			};
			const file2: TrackedFile = {
				path: "commands/marketing.md",
				checksum: "def456def456def456def456def456def456def456def456def456def456def4",
				ownership: "ck",
				installedVersion: "v0.1.0",
			};

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.2.3",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [file1],
					},
					marketing: {
						version: "v0.1.0",
						installedAt: "2024-02-01T00:00:00.000Z",
						files: [file2],
					},
				},
			};

			const result = getAllTrackedFiles(metadata);
			expect(result.length).toBe(2);
			expect(result.map((f) => f.path)).toContain("commands/engineer.md");
			expect(result.map((f) => f.path)).toContain("commands/marketing.md");
		});

		it("returns files from legacy format", () => {
			const file: TrackedFile = {
				path: "commands/test.md",
				checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
				ownership: "ck",
				installedVersion: "v1.0.0",
			};

			const metadata: Metadata = {
				version: "v1.0.0",
				files: [file],
			};

			const result = getAllTrackedFiles(metadata);
			expect(result.length).toBe(1);
			expect(result[0].path).toBe("commands/test.md");
		});

		it("returns empty array when no files", () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};

			const result = getAllTrackedFiles(metadata);
			expect(result.length).toBe(0);
		});
	});

	describe("getInstalledKits", () => {
		it("returns kits from multi-kit structure", () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
					marketing: {
						version: "v0.1.0",
						installedAt: "2024-02-01T00:00:00.000Z",
					},
				},
			};

			const result = getInstalledKits(metadata);
			expect(result).toContain("engineer");
			expect(result).toContain("marketing");
		});

		it("detects engineer from legacy name", () => {
			const metadata: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v1.0.0",
			};

			const result = getInstalledKits(metadata);
			expect(result).toEqual(["engineer"]);
		});

		it("detects marketing from legacy name", () => {
			const metadata: Metadata = {
				name: "ClaudeKit Marketing",
				version: "v0.1.0",
			};

			const result = getInstalledKits(metadata);
			expect(result).toEqual(["marketing"]);
		});

		it("defaults to engineer for unnamed legacy", () => {
			const metadata: Metadata = {
				version: "v1.0.0",
			};

			const result = getInstalledKits(metadata);
			expect(result).toEqual(["engineer"]);
		});

		it("returns empty array for empty metadata", () => {
			const metadata: Metadata = {};

			const result = getInstalledKits(metadata);
			expect(result.length).toBe(0);
		});
	});
});
