import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SelectiveMerger } from "@/domains/installation/selective-merger.js";
import type { ReleaseManifest } from "@/domains/migration/release-manifest.js";
import { OwnershipChecker } from "@/services/file-operations/ownership-checker.js";

describe("SelectiveMerger", () => {
	let tempDir: string;
	let sourceDir: string;
	let destDir: string;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`selective-merger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		sourceDir = join(tempDir, "source");
		destDir = join(tempDir, "dest");
		await mkdir(sourceDir, { recursive: true });
		await mkdir(destDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("shouldCopyFile", () => {
		describe("new files (dest doesn't exist)", () => {
			test("returns changed=true for new file", async () => {
				const sourcePath = join(sourceDir, "new-file.txt");
				await writeFile(sourcePath, "content");
				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "new-file.txt", checksum, size: 7 }],
				};

				const merger = new SelectiveMerger(manifest);
				const destPath = join(destDir, "new-file.txt");

				const result = await merger.shouldCopyFile(destPath, "new-file.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("new");
			});

			test("returns changed=true for new file in nested directory", async () => {
				const nestedDir = join(sourceDir, "hooks", "scripts");
				await mkdir(nestedDir, { recursive: true });
				const sourcePath = join(nestedDir, "hook.cjs");
				await writeFile(sourcePath, "module.exports = {}");
				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "hooks/scripts/hook.cjs", checksum, size: 19 }],
				};

				const merger = new SelectiveMerger(manifest);
				const destPath = join(destDir, "hooks", "scripts", "hook.cjs");

				const result = await merger.shouldCopyFile(destPath, "hooks/scripts/hook.cjs");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("new");
			});
		});

		describe("unchanged files (same size, same checksum)", () => {
			test("returns changed=false for identical text file", async () => {
				const content = "unchanged content";
				const sourcePath = join(sourceDir, "unchanged.txt");
				const destPath = join(destDir, "unchanged.txt");
				await writeFile(sourcePath, content);
				await writeFile(destPath, content);

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "unchanged.txt", checksum, size: content.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "unchanged.txt");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
				expect(result.sourceChecksum).toBe(checksum);
				expect(result.destChecksum).toBe(checksum);
			});

			test("returns changed=false for identical empty file", async () => {
				const sourcePath = join(sourceDir, "empty.txt");
				const destPath = join(destDir, "empty.txt");
				await writeFile(sourcePath, "");
				await writeFile(destPath, "");

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "empty.txt", checksum, size: 0 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "empty.txt");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});

			test("returns changed=false for identical JSON file", async () => {
				const content = JSON.stringify({ key: "value", nested: { arr: [1, 2, 3] } }, null, 2);
				const sourcePath = join(sourceDir, "config.json");
				const destPath = join(destDir, "config.json");
				await writeFile(sourcePath, content);
				await writeFile(destPath, content);

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "config.json", checksum, size: content.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "config.json");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});

			test("returns changed=false for identical file in nested path", async () => {
				const content = "nested file content";
				const nestedSrc = join(sourceDir, "commands", "ck");
				const nestedDest = join(destDir, "commands", "ck");
				await mkdir(nestedSrc, { recursive: true });
				await mkdir(nestedDest, { recursive: true });

				const sourcePath = join(nestedSrc, "help.md");
				const destPath = join(nestedDest, "help.md");
				await writeFile(sourcePath, content);
				await writeFile(destPath, content);

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "commands/ck/help.md", checksum, size: content.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "commands/ck/help.md");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});

			test("returns changed=false for file with special characters content", async () => {
				const content = "Special: émojis 🎉, tabs\t, newlines\n, unicode: 你好";
				const sourcePath = join(sourceDir, "special.txt");
				const destPath = join(destDir, "special.txt");
				await writeFile(sourcePath, content);
				await writeFile(destPath, content);

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "special.txt", checksum, size: Buffer.byteLength(content) }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "special.txt");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});
		});

		describe("size differs (fast path)", () => {
			test("returns changed=true when dest is larger", async () => {
				const sourcePath = join(sourceDir, "size-diff.txt");
				const destPath = join(destDir, "size-diff.txt");
				await writeFile(sourcePath, "short");
				await writeFile(destPath, "much longer content here");

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "size-diff.txt", checksum, size: 5 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "size-diff.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("size-differ");
				expect(result.sourceChecksum).toBe(checksum);
				expect(result.destChecksum).toBeUndefined(); // Checksum not calculated for size diff
			});

			test("returns changed=true when dest is smaller", async () => {
				const sourcePath = join(sourceDir, "size-diff2.txt");
				const destPath = join(destDir, "size-diff2.txt");
				await writeFile(sourcePath, "longer content");
				await writeFile(destPath, "short");

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "size-diff2.txt", checksum, size: 14 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "size-diff2.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("size-differ");
			});

			test("returns changed=true when dest is empty but source is not", async () => {
				const sourcePath = join(sourceDir, "was-empty.txt");
				const destPath = join(destDir, "was-empty.txt");
				await writeFile(sourcePath, "now has content");
				await writeFile(destPath, "");

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "was-empty.txt", checksum, size: 15 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "was-empty.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("size-differ");
			});

			test("returns changed=true when source is empty but dest is not", async () => {
				const sourcePath = join(sourceDir, "now-empty.txt");
				const destPath = join(destDir, "now-empty.txt");
				await writeFile(sourcePath, "");
				await writeFile(destPath, "had content");

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "now-empty.txt", checksum, size: 0 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "now-empty.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("size-differ");
			});
		});

		describe("checksum differs (slow path - same size)", () => {
			test("returns changed=true for same size, different content", async () => {
				const sourcePath = join(sourceDir, "checksum-diff.txt");
				const destPath = join(destDir, "checksum-diff.txt");
				await writeFile(sourcePath, "content-a");
				await writeFile(destPath, "content-b");

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "checksum-diff.txt", checksum, size: 9 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "checksum-diff.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("checksum-differ");
				expect(result.sourceChecksum).toBe(checksum);
				expect(result.destChecksum).toBeDefined();
				expect(result.destChecksum).not.toBe(checksum);
			});

			test("returns changed=true for same length strings with different chars", async () => {
				const sourcePath = join(sourceDir, "abc.txt");
				const destPath = join(destDir, "abc.txt");
				await writeFile(sourcePath, "abc");
				await writeFile(destPath, "xyz");

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "abc.txt", checksum, size: 3 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "abc.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("checksum-differ");
			});

			test("returns changed=true for JSON with same size but different values", async () => {
				const sourceContent = '{"a":1}';
				const destContent = '{"b":2}';
				const sourcePath = join(sourceDir, "config.json");
				const destPath = join(destDir, "config.json");
				await writeFile(sourcePath, sourceContent);
				await writeFile(destPath, destContent);

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "config.json", checksum, size: sourceContent.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "config.json");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("checksum-differ");
			});
		});

		describe("manifest entry missing", () => {
			test("returns changed=true when file not in manifest", async () => {
				const sourcePath = join(sourceDir, "unlisted.txt");
				const destPath = join(destDir, "unlisted.txt");
				await writeFile(sourcePath, "content");
				await writeFile(destPath, "content");

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "other-file.txt", checksum: "a".repeat(64), size: 10 }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "unlisted.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("new");
			});

			test("returns changed=true with empty manifest files array", async () => {
				const destPath = join(destDir, "any.txt");
				await writeFile(destPath, "content");

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "any.txt");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("new");
			});
		});

		describe("path matching", () => {
			test("matches exact path with forward slashes", async () => {
				const content = "nested content";
				const nestedDest = join(destDir, "dir1", "dir2");
				await mkdir(nestedDest, { recursive: true });
				const destPath = join(nestedDest, "file.txt");
				await writeFile(destPath, content);

				const checksum = await OwnershipChecker.calculateChecksum(destPath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "dir1/dir2/file.txt", checksum, size: content.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "dir1/dir2/file.txt");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});

			test("handles deeply nested paths", async () => {
				const content = "deep content";
				const deepPath = join(destDir, "a", "b", "c", "d", "e");
				await mkdir(deepPath, { recursive: true });
				const destPath = join(deepPath, "deep.txt");
				await writeFile(destPath, content);

				const checksum = await OwnershipChecker.calculateChecksum(destPath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "a/b/c/d/e/deep.txt", checksum, size: content.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "a/b/c/d/e/deep.txt");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});
		});

		describe("binary content handling", () => {
			test("handles binary content correctly", async () => {
				const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
				const sourcePath = join(sourceDir, "binary.bin");
				const destPath = join(destDir, "binary.bin");
				await writeFile(sourcePath, binaryContent);
				await writeFile(destPath, binaryContent);

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "binary.bin", checksum, size: binaryContent.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "binary.bin");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});

			test("detects changes in binary content", async () => {
				const sourceContent = Buffer.from([0x00, 0x01, 0x02]);
				const destContent = Buffer.from([0x00, 0x01, 0x03]);
				const sourcePath = join(sourceDir, "binary-diff.bin");
				const destPath = join(destDir, "binary-diff.bin");
				await writeFile(sourcePath, sourceContent);
				await writeFile(destPath, destContent);

				const checksum = await OwnershipChecker.calculateChecksum(sourcePath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [{ path: "binary-diff.bin", checksum, size: sourceContent.length }],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "binary-diff.bin");

				expect(result.changed).toBe(true);
				expect(result.reason).toBe("checksum-differ");
			});
		});

		describe("multiple files in manifest", () => {
			test("correctly identifies file among many", async () => {
				const content = "target file";
				const destPath = join(destDir, "target.txt");
				await writeFile(destPath, content);

				const checksum = await OwnershipChecker.calculateChecksum(destPath);

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [
						{ path: "file1.txt", checksum: "1".repeat(64), size: 100 },
						{ path: "file2.txt", checksum: "2".repeat(64), size: 200 },
						{ path: "target.txt", checksum, size: content.length },
						{ path: "file4.txt", checksum: "4".repeat(64), size: 400 },
						{ path: "dir/file5.txt", checksum: "5".repeat(64), size: 500 },
					],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "target.txt");

				expect(result.changed).toBe(false);
				expect(result.reason).toBe("unchanged");
			});

			test("correctly identifies changed file among unchanged", async () => {
				const destPath = join(destDir, "changed.txt");
				await writeFile(destPath, "modified content");

				const manifest: ReleaseManifest = {
					version: "v1.0.0",
					generatedAt: new Date().toISOString(),
					files: [
						{ path: "file1.txt", checksum: "1".repeat(64), size: 100 },
						{ path: "changed.txt", checksum: "original".padEnd(64, "0"), size: 16 },
						{ path: "file3.txt", checksum: "3".repeat(64), size: 300 },
					],
				};

				const merger = new SelectiveMerger(manifest);
				const result = await merger.shouldCopyFile(destPath, "changed.txt");

				expect(result.changed).toBe(true);
				// Could be size-differ or checksum-differ depending on content
				expect(["size-differ", "checksum-differ"]).toContain(result.reason);
			});
		});
	});

	describe("hasManifest", () => {
		test("returns true when manifest has files", () => {
			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "file.txt", checksum: "a".repeat(64), size: 10 }],
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.hasManifest()).toBe(true);
		});

		test("returns false when manifest is null", () => {
			const merger = new SelectiveMerger(null);
			expect(merger.hasManifest()).toBe(false);
		});

		test("returns false when manifest has no files", () => {
			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [],
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.hasManifest()).toBe(false);
		});

		test("returns true for manifest with single file", () => {
			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "single.txt", checksum: "x".repeat(64), size: 1 }],
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.hasManifest()).toBe(true);
		});

		test("returns true for manifest with many files", () => {
			const files = Array.from({ length: 100 }, (_, i) => ({
				path: `file${i}.txt`,
				checksum: `${i}`.repeat(64).slice(0, 64),
				size: i * 10,
			}));

			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files,
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.hasManifest()).toBe(true);
		});
	});

	describe("getManifestFileCount", () => {
		test("returns correct file count", () => {
			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [
					{ path: "file1.txt", checksum: "a".repeat(64), size: 10 },
					{ path: "file2.txt", checksum: "b".repeat(64), size: 20 },
					{ path: "dir/file3.txt", checksum: "c".repeat(64), size: 30 },
				],
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.getManifestFileCount()).toBe(3);
		});

		test("returns 0 for null manifest", () => {
			const merger = new SelectiveMerger(null);
			expect(merger.getManifestFileCount()).toBe(0);
		});

		test("returns 0 for empty files array", () => {
			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [],
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.getManifestFileCount()).toBe(0);
		});

		test("returns 1 for single file", () => {
			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "single.txt", checksum: "a".repeat(64), size: 10 }],
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.getManifestFileCount()).toBe(1);
		});

		test("returns correct count for large manifest", () => {
			const files = Array.from({ length: 800 }, (_, i) => ({
				path: `file${i}.txt`,
				checksum: `${i}`.repeat(64).slice(0, 64),
				size: i,
			}));

			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files,
			};

			const merger = new SelectiveMerger(manifest);
			expect(merger.getManifestFileCount()).toBe(800);
		});
	});

	describe("manifest map lookup efficiency", () => {
		test("O(1) lookup with Map instead of array find", async () => {
			// Create large manifest to test lookup efficiency
			const files = Array.from({ length: 1000 }, (_, i) => ({
				path: `dir${Math.floor(i / 100)}/subdir${Math.floor(i / 10) % 10}/file${i}.txt`,
				checksum: `${i}`.padStart(64, "0"),
				size: i * 10,
			}));

			// Add target file at the end
			const targetContent = "target content";
			const destPath = join(destDir, "target.txt");
			await writeFile(destPath, targetContent);
			const targetChecksum = await OwnershipChecker.calculateChecksum(destPath);
			files.push({ path: "target.txt", checksum: targetChecksum, size: targetContent.length });

			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files,
			};

			const merger = new SelectiveMerger(manifest);

			// Should find the file efficiently
			const startTime = performance.now();
			const result = await merger.shouldCopyFile(destPath, "target.txt");
			const endTime = performance.now();

			expect(result.changed).toBe(false);
			expect(result.reason).toBe("unchanged");
			// Should complete in reasonable time (< 100ms for 1000 files)
			expect(endTime - startTime).toBeLessThan(100);
		});
	});

	describe("edge cases", () => {
		test("handles file with only whitespace", async () => {
			const content = "   \t\n  ";
			const destPath = join(destDir, "whitespace.txt");
			await writeFile(destPath, content);

			const checksum = await OwnershipChecker.calculateChecksum(destPath);

			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "whitespace.txt", checksum, size: content.length }],
			};

			const merger = new SelectiveMerger(manifest);
			const result = await merger.shouldCopyFile(destPath, "whitespace.txt");

			expect(result.changed).toBe(false);
			expect(result.reason).toBe("unchanged");
		});

		test("handles file with null bytes", async () => {
			const content = "before\x00after";
			const destPath = join(destDir, "nullbyte.txt");
			await writeFile(destPath, content);

			const checksum = await OwnershipChecker.calculateChecksum(destPath);

			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "nullbyte.txt", checksum, size: content.length }],
			};

			const merger = new SelectiveMerger(manifest);
			const result = await merger.shouldCopyFile(destPath, "nullbyte.txt");

			expect(result.changed).toBe(false);
			expect(result.reason).toBe("unchanged");
		});

		test("handles large file simulation (content)", async () => {
			// Simulate larger file with repeated content
			const content = "x".repeat(10000);
			const destPath = join(destDir, "large.txt");
			await writeFile(destPath, content);

			const checksum = await OwnershipChecker.calculateChecksum(destPath);

			const manifest: ReleaseManifest = {
				version: "v1.0.0",
				generatedAt: new Date().toISOString(),
				files: [{ path: "large.txt", checksum, size: content.length }],
			};

			const merger = new SelectiveMerger(manifest);
			const result = await merger.shouldCopyFile(destPath, "large.txt");

			expect(result.changed).toBe(false);
			expect(result.reason).toBe("unchanged");
		});
	});
});

describe("SelectiveMerger - Multi-Kit", () => {
	let tempDir: string;
	let claudeDir: string;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`selective-merger-multikit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		claudeDir = tempDir;
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	const createManifest = (
		files: { path: string; checksum: string; size: number }[],
		version = "2.0.0",
	): ReleaseManifest => ({
		version,
		generatedAt: "2025-01-01T00:00:00Z",
		files,
	});

	test("returns shared-identical when file matches other kit with same checksum", async () => {
		// Setup: engineer kit has skills/shared.md with a specific checksum
		const checksum = "a".repeat(64);
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
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		// Create actual file with matching checksum
		const filePath = join(claudeDir, "skills", "shared.md");
		await mkdir(join(claudeDir, "skills"), { recursive: true });
		await writeFile(filePath, "shared content");

		// Marketing kit trying to install same file
		const manifest = createManifest([{ path: "skills/shared.md", checksum, size: 14 }]);
		const merger = new SelectiveMerger(manifest);
		merger.setMultiKitContext(claudeDir, "marketing");

		const result = await merger.shouldCopyFile(filePath, "skills/shared.md");
		expect(result.changed).toBe(false);
		expect(result.reason).toBe("shared-identical");
		expect(result.sharedWithKit).toBe("engineer");
	});

	test("returns shared-older when incoming version is older than installed", async () => {
		// Engineer has v2.0.0, marketing incoming is v1.0.0
		const checksum1 = "a".repeat(64);
		const checksum2 = "b".repeat(64);
		const metadata = {
			kits: {
				engineer: {
					version: "2.0.0", // Newer
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/shared.md",
							checksum: checksum1,
							ownership: "ck",
							installedVersion: "2.0.0",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const filePath = join(claudeDir, "skills", "shared.md");
		await mkdir(join(claudeDir, "skills"), { recursive: true });
		await writeFile(filePath, "newer content from engineer");

		// Marketing v1.0.0 trying to install different checksum
		const manifest = createManifest(
			[{ path: "skills/shared.md", checksum: checksum2, size: 20 }],
			"1.0.0", // Older
		);
		const merger = new SelectiveMerger(manifest);
		merger.setMultiKitContext(claudeDir, "marketing");

		const result = await merger.shouldCopyFile(filePath, "skills/shared.md");
		expect(result.changed).toBe(false);
		expect(result.reason).toBe("shared-older");
	});

	test("allows update when incoming version is newer than installed", async () => {
		// Engineer has v1.0.0, marketing incoming is v2.0.0
		const checksum1 = "a".repeat(64);
		const checksum2 = "b".repeat(64);
		const metadata = {
			kits: {
				engineer: {
					version: "1.0.0", // Older
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/shared.md",
							checksum: checksum1,
							ownership: "ck",
							installedVersion: "1.0.0",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const filePath = join(claudeDir, "skills", "shared.md");
		await mkdir(join(claudeDir, "skills"), { recursive: true });
		await writeFile(filePath, "old content from engineer");

		// Marketing v2.0.0 trying to install different checksum (newer version)
		const manifest = createManifest(
			[{ path: "skills/shared.md", checksum: checksum2, size: 25 }],
			"2.0.0", // Newer
		);
		const merger = new SelectiveMerger(manifest);
		merger.setMultiKitContext(claudeDir, "marketing");

		const result = await merger.shouldCopyFile(filePath, "skills/shared.md");
		// Should proceed to normal comparison (size/checksum) and allow update
		expect(result.changed).toBe(true);
	});

	test("falls back to normal comparison when no multi-kit context set", async () => {
		// Even with metadata.json, if context is not set, should use normal logic
		const fileContent = "shared content";

		const filePath = join(claudeDir, "skills", "shared.md");
		await mkdir(join(claudeDir, "skills"), { recursive: true });
		await writeFile(filePath, fileContent);

		// Calculate actual checksum of the file content
		const actualChecksum = await OwnershipChecker.calculateChecksum(filePath);

		// Set up metadata (this should be ignored since we don't set multi-kit context)
		const metadata = {
			kits: {
				engineer: {
					version: "1.0.0",
					installedAt: "2025-01-01T00:00:00Z",
					files: [
						{
							path: "skills/shared.md",
							checksum: actualChecksum,
							ownership: "ck",
							installedVersion: "1.0.0",
						},
					],
				},
			},
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		// No setMultiKitContext call - manifest checksum matches file checksum
		const manifest = createManifest([
			{ path: "skills/shared.md", checksum: actualChecksum, size: fileContent.length },
		]);
		const merger = new SelectiveMerger(manifest);
		// Deliberately not calling setMultiKitContext

		const result = await merger.shouldCopyFile(filePath, "skills/shared.md");
		// Should use normal "unchanged" logic, not "shared-identical"
		expect(result.changed).toBe(false);
		expect(result.reason).toBe("unchanged");
	});

	test("handles missing kit metadata gracefully", async () => {
		// Metadata exists but kits section is missing
		const metadata = {
			name: "Legacy Metadata",
			version: "1.0.0",
		};
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(metadata));

		const checksum = "a".repeat(64);
		const filePath = join(claudeDir, "skills", "file.md");
		await mkdir(join(claudeDir, "skills"), { recursive: true });
		await writeFile(filePath, "content");

		const manifest = createManifest([{ path: "skills/file.md", checksum, size: 7 }]);
		const merger = new SelectiveMerger(manifest);
		merger.setMultiKitContext(claudeDir, "marketing");

		// Should fall back to normal comparison
		const result = await merger.shouldCopyFile(filePath, "skills/file.md");
		// Since no other kit owns this file, proceed normally
		expect(["checksum-differ", "size-differ", "unchanged"]).toContain(result.reason);
	});
});
