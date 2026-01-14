import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type FileConflictInfo, SelectiveMerger } from "@/domains/installation/selective-merger.js";
import type { ReleaseManifest } from "@/domains/migration/release-manifest.js";

/**
 * Tests for timestamp-based dual-kit conflict resolution
 *
 * Resolution strategy: last-modified wins
 * - Incoming timestamp > existing → incoming wins
 * - Existing timestamp > incoming → existing wins
 * - Same timestamp → tie, existing wins (first installed)
 * - No timestamps → version comparison fallback
 */
describe("Timestamp-Based Conflict Resolution", () => {
	let tempDir: string;
	let claudeDir: string;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`timestamp-conflict-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		claudeDir = tempDir;
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	const createManifest = (
		files: { path: string; checksum: string; size: number; lastModified?: string }[],
		version = "2.0.0",
	): ReleaseManifest => ({
		version,
		generatedAt: "2025-01-01T00:00:00Z",
		files,
	});

	const createMetadata = async (
		kit: string,
		files: Array<{
			path: string;
			checksum: string;
			sourceTimestamp?: string;
			installedVersion?: string;
		}>,
	) => {
		const metadata = {
			kits: {
				[kit]: {
					version: "1.0.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: files.map((f) => ({
						path: f.path,
						checksum: f.checksum,
						ownership: "ck",
						installedVersion: f.installedVersion || "1.0.0",
						sourceTimestamp: f.sourceTimestamp,
					})),
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));
	};

	describe("Incoming Newer (incoming wins)", () => {
		test("updates file when incoming timestamp is newer", async () => {
			const checksum1 = "a".repeat(64);
			const checksum2 = "b".repeat(64);

			// Engineer has file from 2025-01-01
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: checksum1,
					sourceTimestamp: "2025-01-01T12:00:00Z",
				},
			]);

			// Create file on disk
			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "old content");

			// Marketing incoming from 2025-06-15 (newer)
			const manifest = createManifest([
				{
					path: "skills/shared.md",
					checksum: checksum2,
					size: 11,
					lastModified: "2025-06-15T12:00:00Z",
				},
			]);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			expect(result.changed).toBe(true);
			expect(result.reason).toBe("shared-newer");
			expect(result.conflictInfo).toBeDefined();
			expect(result.conflictInfo?.winner).toBe("incoming");
			expect(result.conflictInfo?.reason).toBe("newer");
			expect(result.conflictInfo?.incomingKit).toBe("marketing");
			expect(result.conflictInfo?.existingKit).toBe("engineer");
		});

		test("includes correct timestamps in conflictInfo", async () => {
			const incomingTs = "2025-12-01T10:00:00+00:00";
			const existingTs = "2025-06-01T10:00:00+00:00";

			await createMetadata("engineer", [
				{
					path: "agents/shared.md",
					checksum: "a".repeat(64),
					sourceTimestamp: existingTs,
				},
			]);

			const filePath = join(claudeDir, "agents", "shared.md");
			await mkdir(join(claudeDir, "agents"), { recursive: true });
			await writeFile(filePath, "content");

			const manifest = createManifest([
				{
					path: "agents/shared.md",
					checksum: "b".repeat(64),
					size: 7,
					lastModified: incomingTs,
				},
			]);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "agents/shared.md");

			expect(result.conflictInfo?.incomingTimestamp).toBe(incomingTs);
			expect(result.conflictInfo?.existingTimestamp).toBe(existingTs);
		});
	});

	describe("Existing Newer (existing wins)", () => {
		test("keeps file when existing timestamp is newer", async () => {
			const checksum1 = "a".repeat(64);
			const checksum2 = "b".repeat(64);

			// Engineer has file from 2025-12-01 (newer)
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: checksum1,
					sourceTimestamp: "2025-12-01T12:00:00Z",
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "newer content from engineer");

			// Marketing incoming from 2025-01-15 (older)
			const manifest = createManifest([
				{
					path: "skills/shared.md",
					checksum: checksum2,
					size: 11,
					lastModified: "2025-01-15T12:00:00Z",
				},
			]);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			expect(result.changed).toBe(false);
			expect(result.reason).toBe("shared-older");
			expect(result.conflictInfo).toBeDefined();
			expect(result.conflictInfo?.winner).toBe("existing");
			expect(result.conflictInfo?.reason).toBe("existing-newer");
		});
	});

	describe("Tie-breaker (existing wins)", () => {
		test("keeps existing when timestamps are identical", async () => {
			const sameTimestamp = "2025-06-15T12:00:00Z";

			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					sourceTimestamp: sameTimestamp,
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			const manifest = createManifest([
				{
					path: "skills/shared.md",
					checksum: "b".repeat(64),
					size: 7,
					lastModified: sameTimestamp, // Same timestamp
				},
			]);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			expect(result.changed).toBe(false);
			expect(result.reason).toBe("shared-older");
			expect(result.conflictInfo?.winner).toBe("existing");
			expect(result.conflictInfo?.reason).toBe("tie");
		});
	});

	describe("Version Fallback (no timestamps)", () => {
		test("uses version comparison when incoming has no timestamp", async () => {
			// Engineer has v1.0.0
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					// No sourceTimestamp
					installedVersion: "1.0.0",
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			// Marketing v2.0.0 (newer version, no lastModified)
			const manifest = createManifest(
				[
					{
						path: "skills/shared.md",
						checksum: "b".repeat(64),
						size: 7,
						// No lastModified
					},
				],
				"2.0.0",
			);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			expect(result.changed).toBe(true);
			expect(result.reason).toBe("shared-newer");
			expect(result.conflictInfo?.reason).toBe("no-timestamps");
		});

		test("keeps existing when incoming version is older (no timestamps)", async () => {
			// Engineer has v2.0.0
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					installedVersion: "2.0.0",
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			// Marketing v1.0.0 (older version)
			const manifest = createManifest(
				[
					{
						path: "skills/shared.md",
						checksum: "b".repeat(64),
						size: 7,
					},
				],
				"1.0.0",
			);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			expect(result.changed).toBe(false);
			expect(result.reason).toBe("shared-older");
			expect(result.conflictInfo?.reason).toBe("no-timestamps");
		});

		test("uses version comparison when existing has no timestamp", async () => {
			// Engineer v1.0.0, no sourceTimestamp
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					installedVersion: "1.0.0",
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			// Marketing v2.0.0 with timestamp
			const manifest = createManifest(
				[
					{
						path: "skills/shared.md",
						checksum: "b".repeat(64),
						size: 7,
						lastModified: "2025-06-15T12:00:00Z",
					},
				],
				"2.0.0",
			);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			// Should update (newer version) even though timestamps don't match
			expect(result.changed).toBe(true);
		});
	});

	describe("Invalid Timestamp Handling", () => {
		test("falls back to version when incoming timestamp is invalid", async () => {
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					sourceTimestamp: "2025-06-01T12:00:00Z",
					installedVersion: "1.0.0",
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			// Invalid timestamp
			const manifest = createManifest(
				[
					{
						path: "skills/shared.md",
						checksum: "b".repeat(64),
						size: 7,
						lastModified: "not-a-valid-date",
					},
				],
				"2.0.0",
			);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			// Should fall back to version comparison
			expect(result.changed).toBe(true);
		});

		test("falls back to version when existing timestamp is invalid", async () => {
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					sourceTimestamp: "invalid-timestamp",
					installedVersion: "1.0.0",
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			const manifest = createManifest(
				[
					{
						path: "skills/shared.md",
						checksum: "b".repeat(64),
						size: 7,
						lastModified: "2025-06-15T12:00:00Z",
					},
				],
				"2.0.0",
			);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			// Should update (newer version)
			expect(result.changed).toBe(true);
		});
	});

	describe("Timezone-Aware Comparison", () => {
		test("correctly compares timestamps with different timezones", async () => {
			// These are the same instant in time
			// 2025-06-15T12:00:00Z = 2025-06-15T14:00:00+02:00
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					sourceTimestamp: "2025-06-15T14:00:00+02:00", // Same as 12:00 UTC
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			const manifest = createManifest([
				{
					path: "skills/shared.md",
					checksum: "b".repeat(64),
					size: 7,
					lastModified: "2025-06-15T12:00:00Z", // 12:00 UTC
				},
			]);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			// Should be a tie (same instant)
			expect(result.conflictInfo?.reason).toBe("tie");
		});

		test("newer timezone-offset timestamp wins", async () => {
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					sourceTimestamp: "2025-06-15T10:00:00-05:00", // 15:00 UTC
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			const manifest = createManifest([
				{
					path: "skills/shared.md",
					checksum: "b".repeat(64),
					size: 7,
					lastModified: "2025-06-15T18:00:00+02:00", // 16:00 UTC (newer)
				},
			]);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			expect(result.changed).toBe(true);
			expect(result.conflictInfo?.winner).toBe("incoming");
			expect(result.conflictInfo?.reason).toBe("newer");
		});
	});

	describe("Backward Compatibility", () => {
		test("works with pre-timestamp metadata (no sourceTimestamp field)", async () => {
			// Old metadata without sourceTimestamp
			const metadata = {
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: "2025-01-01T00:00:00Z",
						files: [
							{
								path: "skills/shared.md",
								checksum: "a".repeat(64),
								ownership: "ck",
								installedVersion: "1.0.0",
								// No sourceTimestamp (old format)
							},
						],
					},
				},
			};
			await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			// New manifest with timestamp
			const manifest = createManifest(
				[
					{
						path: "skills/shared.md",
						checksum: "b".repeat(64),
						size: 7,
						lastModified: "2025-06-15T12:00:00Z",
					},
				],
				"2.0.0",
			);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			// Should use version fallback since existing has no timestamp
			expect(result.changed).toBe(true); // v2.0.0 > v1.0.0
		});

		test("works with manifest without lastModified", async () => {
			await createMetadata("engineer", [
				{
					path: "skills/shared.md",
					checksum: "a".repeat(64),
					sourceTimestamp: "2025-06-15T12:00:00Z",
					installedVersion: "1.0.0",
				},
			]);

			const filePath = join(claudeDir, "skills", "shared.md");
			await mkdir(join(claudeDir, "skills"), { recursive: true });
			await writeFile(filePath, "content");

			// Old manifest without lastModified
			const manifest = createManifest(
				[
					{
						path: "skills/shared.md",
						checksum: "b".repeat(64),
						size: 7,
						// No lastModified (old format)
					},
				],
				"2.0.0",
			);

			const merger = new SelectiveMerger(manifest);
			merger.setMultiKitContext(claudeDir, "marketing");

			const result = await merger.shouldCopyFile(filePath, "skills/shared.md");

			// Should use version fallback
			expect(result.changed).toBe(true); // v2.0.0 > v1.0.0
		});
	});
});

describe("ConflictInfo Aggregation", () => {
	let tempDir: string;
	let claudeDir: string;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`conflict-info-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		claudeDir = tempDir;
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("conflictInfo contains all required fields", async () => {
		const metadata = {
			kits: {
				engineer: {
					version: "1.0.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/test.md",
							checksum: "a".repeat(64),
							ownership: "ck",
							installedVersion: "1.0.0",
							sourceTimestamp: "2025-01-01T12:00:00Z",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const filePath = join(claudeDir, "skills", "test.md");
		await mkdir(join(claudeDir, "skills"), { recursive: true });
		await writeFile(filePath, "content");

		const manifest: ReleaseManifest = {
			version: "2.0.0",
			generatedAt: "2025-01-01T00:00:00Z",
			files: [
				{
					path: "skills/test.md",
					checksum: "b".repeat(64),
					size: 7,
					lastModified: "2025-06-15T12:00:00Z",
				},
			],
		};

		const merger = new SelectiveMerger(manifest);
		merger.setMultiKitContext(claudeDir, "marketing");

		const result = await merger.shouldCopyFile(filePath, "skills/test.md");
		const info = result.conflictInfo as FileConflictInfo;

		expect(info).toBeDefined();
		expect(info.relativePath).toBe("skills/test.md");
		expect(info.incomingKit).toBe("marketing");
		expect(info.existingKit).toBe("engineer");
		expect(info.incomingTimestamp).toBe("2025-06-15T12:00:00Z");
		expect(info.existingTimestamp).toBe("2025-01-01T12:00:00Z");
		expect(info.winner).toBe("incoming");
		expect(info.reason).toBe("newer");
	});
});
