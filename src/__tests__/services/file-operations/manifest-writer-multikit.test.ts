/**
 * Tests for ManifestWriter multi-kit functionality
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ManifestWriter } from "@/services/file-operations/manifest-writer.js";
import type { Metadata, TrackedFile } from "@/types";

describe("ManifestWriter multi-kit", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `manifest-writer-multikit-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("writeManifest (multi-kit)", () => {
		it("creates multi-kit structure for fresh install", async () => {
			const writer = new ManifestWriter();

			await writer.writeManifest(testDir, "ClaudeKit Engineer", "v1.2.3", "local", "engineer");

			const content = await readFile(join(testDir, "metadata.json"), "utf-8");
			const metadata = JSON.parse(content) as Metadata;

			expect(metadata.kits).toBeDefined();
			expect(metadata.kits?.engineer?.version).toBe("v1.2.3");
			expect(metadata.scope).toBe("local");
			// Legacy fields preserved for backward compat
			expect(metadata.name).toBe("ClaudeKit Engineer");
			expect(metadata.version).toBe("v1.2.3");
		});

		it("preserves existing kits when adding new kit", async () => {
			// Pre-create multi-kit metadata with engineer
			const existing: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [],
					},
				},
				scope: "local",
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(existing));

			// Add marketing kit
			const writer = new ManifestWriter();
			await writer.writeManifest(testDir, "ClaudeKit Marketing", "v0.1.0", "local", "marketing");

			const content = await readFile(join(testDir, "metadata.json"), "utf-8");
			const metadata = JSON.parse(content) as Metadata;

			expect(metadata.kits?.engineer?.version).toBe("v1.0.0");
			expect(metadata.kits?.marketing?.version).toBe("v0.1.0");
		});

		it("updates existing kit version", async () => {
			// Pre-create multi-kit metadata
			const existing: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
				scope: "local",
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(existing));

			// Update engineer kit
			const writer = new ManifestWriter();
			await writer.writeManifest(testDir, "ClaudeKit Engineer", "v2.0.0", "local", "engineer");

			const content = await readFile(join(testDir, "metadata.json"), "utf-8");
			const metadata = JSON.parse(content) as Metadata;

			expect(metadata.kits?.engineer?.version).toBe("v2.0.0");
		});

		it("migrates legacy format before writing", async () => {
			// Pre-create legacy metadata
			const legacy: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v1.0.0",
				installedAt: "2024-01-01T00:00:00.000Z",
				scope: "global",
				files: [],
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			// Write marketing kit (should trigger migration)
			const writer = new ManifestWriter();
			await writer.writeManifest(testDir, "ClaudeKit Marketing", "v0.1.0", "global", "marketing");

			const content = await readFile(join(testDir, "metadata.json"), "utf-8");
			const metadata = JSON.parse(content) as Metadata;

			// Should have both kits
			expect(metadata.kits?.engineer?.version).toBe("v1.0.0");
			expect(metadata.kits?.marketing?.version).toBe("v0.1.0");
			// DEPRECATED: Legacy fields preserved from first kit, not overwritten
			// Use kits object for version display instead
			expect(metadata.name).toBe("ClaudeKit Engineer");
		});

		it("infers kit type from name if not provided", async () => {
			const writer = new ManifestWriter();

			// Marketing kit should be inferred from name
			await writer.writeManifest(testDir, "ClaudeKit Marketing", "v0.1.0", "local");

			const content = await readFile(join(testDir, "metadata.json"), "utf-8");
			const metadata = JSON.parse(content) as Metadata;

			expect(metadata.kits?.marketing?.version).toBe("v0.1.0");
		});

		it("defaults to engineer if kit type cannot be inferred", async () => {
			const writer = new ManifestWriter();

			await writer.writeManifest(testDir, "Some Other Kit", "v1.0.0", "local");

			const content = await readFile(join(testDir, "metadata.json"), "utf-8");
			const metadata = JSON.parse(content) as Metadata;

			expect(metadata.kits?.engineer?.version).toBe("v1.0.0");
		});
	});

	describe("readKitManifest", () => {
		it("returns kit-specific metadata", async () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.2.3",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [],
					},
					marketing: {
						version: "v0.1.0",
						installedAt: "2024-02-01T00:00:00.000Z",
					},
				},
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.readKitManifest(testDir, "engineer");

			expect(result?.version).toBe("v1.2.3");
		});

		it("returns null for non-existent kit", async () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.readKitManifest(testDir, "marketing");

			expect(result).toBeNull();
		});

		it("returns null when no metadata.json", async () => {
			const result = await ManifestWriter.readKitManifest(testDir, "engineer");
			expect(result).toBeNull();
		});
	});

	describe("getUninstallManifest (multi-kit)", () => {
		it("returns all files for full uninstall", async () => {
			const file1: TrackedFile = {
				path: "commands/engineer.md",
				checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
				ownership: "ck",
				installedVersion: "v1.0.0",
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
						version: "v1.0.0",
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
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.getUninstallManifest(testDir);

			expect(result.isMultiKit).toBe(true);
			expect(result.filesToRemove.length).toBe(2);
			expect(result.remainingKits.length).toBe(0);
		});

		it("returns kit-specific files for kit-scoped uninstall", async () => {
			const file1: TrackedFile = {
				path: "commands/engineer.md",
				checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
				ownership: "ck",
				installedVersion: "v1.0.0",
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
						version: "v1.0.0",
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
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.getUninstallManifest(testDir, "engineer");

			expect(result.isMultiKit).toBe(true);
			expect(result.filesToRemove).toContain("commands/engineer.md");
			expect(result.filesToRemove).not.toContain("commands/marketing.md");
			expect(result.remainingKits).toContain("marketing");
		});

		it("preserves shared files during kit-scoped uninstall", async () => {
			const sharedFile: TrackedFile = {
				path: "shared/common.md",
				checksum: "shared1shared1shared1shared1shared1shared1shared1shared1shared1shar",
				ownership: "ck",
				installedVersion: "v1.0.0",
			};
			const engineerFile: TrackedFile = {
				path: "commands/engineer.md",
				checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
				ownership: "ck",
				installedVersion: "v1.0.0",
			};

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [sharedFile, engineerFile],
					},
					marketing: {
						version: "v0.1.0",
						installedAt: "2024-02-01T00:00:00.000Z",
						files: [sharedFile], // Shared file
					},
				},
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.getUninstallManifest(testDir, "engineer");

			// Shared file should be preserved
			expect(result.filesToRemove).toContain("commands/engineer.md");
			expect(result.filesToRemove).not.toContain("shared/common.md");
			expect(result.filesToPreserve).toContain("shared/common.md");
		});

		it("handles shared files with different versions across kits", async () => {
			// Same file tracked by both kits but with different versions/checksums
			const engineerVersion: TrackedFile = {
				path: "shared/config.md",
				checksum: "eng111eng111eng111eng111eng111eng111eng111eng111eng111eng111eng1",
				ownership: "ck",
				installedVersion: "v1.0.0",
			};
			const marketingVersion: TrackedFile = {
				path: "shared/config.md", // Same path
				checksum: "mkt222mkt222mkt222mkt222mkt222mkt222mkt222mkt222mkt222mkt222mkt2", // Different checksum
				ownership: "ck",
				installedVersion: "v0.2.0", // Different version
			};

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [engineerVersion],
					},
					marketing: {
						version: "v0.2.0",
						installedAt: "2024-02-01T00:00:00.000Z",
						files: [marketingVersion],
					},
				},
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			// When uninstalling engineer kit, shared file should be preserved for marketing
			const result = await ManifestWriter.getUninstallManifest(testDir, "engineer");

			expect(result.filesToRemove).not.toContain("shared/config.md");
			expect(result.filesToPreserve).toContain("shared/config.md");
			expect(result.remainingKits).toContain("marketing");
		});

		it("handles files with same checksum but different ownership across kits", async () => {
			// Edge case: same file, same content, but tracked with different ownership
			const sharedChecksum = "same1same1same1same1same1same1same1same1same1same1same1same1same";
			const engineerFile: TrackedFile = {
				path: "shared/utility.md",
				checksum: sharedChecksum,
				ownership: "ck",
				installedVersion: "v1.0.0",
			};
			const marketingFile: TrackedFile = {
				path: "shared/utility.md",
				checksum: sharedChecksum,
				ownership: "ck-modified", // Different ownership status
				installedVersion: "v1.0.0",
			};

			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
						files: [engineerFile],
					},
					marketing: {
						version: "v1.0.0",
						installedAt: "2024-02-01T00:00:00.000Z",
						files: [marketingFile],
					},
				},
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			// Shared file should be preserved regardless of ownership differences
			const result = await ManifestWriter.getUninstallManifest(testDir, "engineer");

			expect(result.filesToRemove).not.toContain("shared/utility.md");
			expect(result.filesToPreserve).toContain("shared/utility.md");
		});

		it("handles legacy format gracefully", async () => {
			const file: TrackedFile = {
				path: "commands/test.md",
				checksum: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
				ownership: "ck",
				installedVersion: "v1.0.0",
			};

			const legacy: Metadata = {
				name: "ClaudeKit Engineer",
				version: "v1.0.0",
				files: [file],
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(legacy));

			const result = await ManifestWriter.getUninstallManifest(testDir);

			expect(result.isMultiKit).toBe(false);
			expect(result.filesToRemove).toContain("commands/test.md");
		});
	});

	describe("removeKitFromManifest", () => {
		it("removes kit from multi-kit metadata", async () => {
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
				scope: "local",
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.removeKitFromManifest(testDir, "engineer");

			expect(result).toBe(true);

			const content = await readFile(join(testDir, "metadata.json"), "utf-8");
			const updated = JSON.parse(content) as Metadata;

			expect(updated.kits?.engineer).toBeUndefined();
			expect(updated.kits?.marketing?.version).toBe("v0.1.0");
		});

		it("returns true even when removing last kit (metadata.json cleanup handled separately)", async () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.removeKitFromManifest(testDir, "engineer");

			expect(result).toBe(true);
		});

		it("returns false for non-existent kit", async () => {
			const metadata: Metadata = {
				kits: {
					engineer: {
						version: "v1.0.0",
						installedAt: "2024-01-01T00:00:00.000Z",
					},
				},
			};
			await writeFile(join(testDir, "metadata.json"), JSON.stringify(metadata));

			const result = await ManifestWriter.removeKitFromManifest(testDir, "marketing");

			expect(result).toBe(false);
		});

		it("returns false when no metadata.json", async () => {
			const result = await ManifestWriter.removeKitFromManifest(testDir, "engineer");
			expect(result).toBe(false);
		});
	});
});
