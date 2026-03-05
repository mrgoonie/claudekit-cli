/**
 * Tests for filterDeletionPaths function
 * Validates filtering of tracked files matching deletion patterns
 */
import { describe, expect, it } from "bun:test";
import { filterDeletionPaths } from "@/domains/sync/deletion-path-filter.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { TrackedFile } from "@/types";

// Helper to create mock TrackedFile
function createTrackedFile(path: string): TrackedFile {
	return {
		path,
		checksum: "abc123",
		ownership: "ck",
		installedVersion: "1.0.0",
	};
}

describe("filterDeletionPaths", () => {
	describe("empty deletions", () => {
		it("returns all files when deletions array is empty", () => {
			const files = [createTrackedFile("commands/foo.md"), createTrackedFile("agents/bar.md")];

			const result = filterDeletionPaths(files, []);
			expect(result).toHaveLength(2);
			expect(result).toEqual(files);
		});

		it("returns all files when deletions is undefined", () => {
			const files = [createTrackedFile("commands/foo.md")];

			const result = filterDeletionPaths(files, undefined);
			expect(result).toEqual(files);
		});
	});

	describe("exact path matching", () => {
		it("filters exact path matches", () => {
			const files = [
				createTrackedFile("agents/copywriter.md"),
				createTrackedFile("agents/developer.md"),
				createTrackedFile("commands/code.md"),
			];
			const deletions = ["agents/copywriter.md"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(2);
			expect(result.map((f) => f.path)).toEqual(["agents/developer.md", "commands/code.md"]);
		});

		it("filters multiple exact paths", () => {
			const files = [
				createTrackedFile("agents/copywriter.md"),
				createTrackedFile("agents/database-admin.md"),
				createTrackedFile("agents/scout.md"),
				createTrackedFile("agents/developer.md"),
			];
			const deletions = ["agents/copywriter.md", "agents/database-admin.md", "agents/scout.md"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(1);
			expect(result[0].path).toBe("agents/developer.md");
		});

		it("does not filter non-matching exact paths", () => {
			const files = [createTrackedFile("agents/developer.md")];
			const deletions = ["agents/copywriter.md"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(1);
		});
	});

	describe("glob pattern matching", () => {
		it("filters files matching glob pattern with **", () => {
			const files = [
				createTrackedFile("commands/code/index.md"),
				createTrackedFile("commands/code/utils.md"),
				createTrackedFile("commands/code/lib/helper.md"),
				createTrackedFile("commands/cook.md"),
			];
			const deletions = ["commands/code/**"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(1);
			expect(result[0].path).toBe("commands/cook.md");
		});

		it("filters files matching glob pattern with *", () => {
			const files = [
				createTrackedFile("skills/test.md"),
				createTrackedFile("skills/foo.md"),
				createTrackedFile("skills/bar.txt"),
				createTrackedFile("agents/test.md"),
			];
			const deletions = ["skills/*.md"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(2);
			expect(result.map((f) => f.path)).toContain("skills/bar.txt");
			expect(result.map((f) => f.path)).toContain("agents/test.md");
		});

		it("filters files matching glob pattern with ?", () => {
			const files = [
				createTrackedFile("test1.md"),
				createTrackedFile("test2.md"),
				createTrackedFile("test10.md"),
			];
			const deletions = ["test?.md"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(1);
			expect(result[0].path).toBe("test10.md");
		});

		it("filters files matching glob pattern with {}", () => {
			const files = [
				createTrackedFile("skills/brainstorm/index.md"),
				createTrackedFile("skills/brainstorming/index.md"),
				createTrackedFile("skills/debug/index.md"),
			];
			const deletions = ["skills/{brainstorm,brainstorming}/**"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(1);
			expect(result[0].path).toBe("skills/debug/index.md");
		});
	});

	describe("mixed exact and glob patterns", () => {
		it("handles mix of exact paths and glob patterns", () => {
			const files = [
				createTrackedFile("agents/copywriter.md"),
				createTrackedFile("agents/developer.md"),
				createTrackedFile("commands/code/index.md"),
				createTrackedFile("commands/code/utils.md"),
				createTrackedFile("commands/cook.md"),
				createTrackedFile("skills/brainstorming/skill.md"),
				createTrackedFile("skills/debug/skill.md"),
			];
			const deletions = [
				"agents/copywriter.md", // exact
				"commands/code/**", // glob
				"skills/brainstorming/**", // glob
			];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(3);
			expect(result.map((f) => f.path)).toEqual([
				"agents/developer.md",
				"commands/cook.md",
				"skills/debug/skill.md",
			]);
		});
	});

	describe("non-matching patterns", () => {
		it("returns all files when no patterns match", () => {
			const files = [
				createTrackedFile("agents/developer.md"),
				createTrackedFile("commands/help.md"),
			];
			const deletions = ["agents/copywriter.md", "commands/old/**"];

			const result = filterDeletionPaths(files, deletions);
			expect(result).toHaveLength(2);
		});
	});

	describe("edge cases", () => {
		it("handles empty files array", () => {
			const result = filterDeletionPaths([], ["agents/**"]);
			expect(result).toHaveLength(0);
		});

		it("preserves file metadata after filtering", () => {
			const file: TrackedFile = {
				path: "agents/developer.md",
				checksum: "xyz789",
				ownership: "ck-modified",
				baseChecksum: "abc123",
				installedVersion: "1.0.0",
			};
			const deletions = ["agents/copywriter.md"];

			const result = filterDeletionPaths([file], deletions);
			expect(result[0]).toEqual(file);
		});
	});
});

describe("PathResolver.isGlobPattern", () => {
	it("returns true for patterns with *", () => {
		expect(PathResolver.isGlobPattern("*.md")).toBe(true);
		expect(PathResolver.isGlobPattern("commands/*")).toBe(true);
		expect(PathResolver.isGlobPattern("**/*.ts")).toBe(true);
	});

	it("returns true for patterns with ?", () => {
		expect(PathResolver.isGlobPattern("test?.md")).toBe(true);
	});

	it("returns true for patterns with {}", () => {
		expect(PathResolver.isGlobPattern("{a,b}.md")).toBe(true);
	});

	it("returns false for plain paths", () => {
		expect(PathResolver.isGlobPattern("agents/copywriter.md")).toBe(false);
		expect(PathResolver.isGlobPattern("commands/code/index.md")).toBe(false);
	});
});
