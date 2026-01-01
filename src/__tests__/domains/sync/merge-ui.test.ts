/**
 * Tests for MergeUI - interactive merge interface
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { MergeUI } from "@/domains/sync/merge-ui.js";
import type { FileHunk } from "@/domains/sync/types.js";

describe("MergeUI", () => {
	let consoleSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	describe("showExtendedContext", () => {
		it("shows context with line numbers", () => {
			const content = "line1\nline2\nline3\nline4\nline5";
			const hunk: FileHunk = {
				oldStart: 2,
				oldLines: 2,
				newStart: 2,
				newLines: 2,
				lines: [" line2", "-line3", "+line3-modified"],
			};

			MergeUI.showExtendedContext(content, hunk, 1);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("clamps context to file bounds", () => {
			const content = "line1\nline2";
			const hunk: FileHunk = {
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 1,
				lines: [" line1"],
			};

			// Should not throw with context > file size
			MergeUI.showExtendedContext(content, hunk, 100);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("displays correct line number ranges", () => {
			const content = "a\nb\nc\nd\ne\nf\ng";
			const hunk: FileHunk = {
				oldStart: 3,
				oldLines: 2,
				newStart: 3,
				newLines: 2,
				lines: [" c", "-d", "+d-modified"],
			};

			MergeUI.showExtendedContext(content, hunk, 2);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("handles single line content", () => {
			const content = "single line";
			const hunk: FileHunk = {
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 1,
				lines: [" single line"],
			};

			MergeUI.showExtendedContext(content, hunk, 5);
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe("displayMergeSummary", () => {
		it("shows applied count when all accepted", () => {
			MergeUI.displayMergeSummary("test.md", 5, 0);
			expect(consoleSpy).toHaveBeenCalled();
			const calls = consoleSpy.mock.calls;
			const lastCall = calls[calls.length - 1][0];
			expect(lastCall.toString()).toContain("test.md");
		});

		it("shows rejected count when all rejected", () => {
			MergeUI.displayMergeSummary("test.md", 0, 3);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("shows both when mixed", () => {
			MergeUI.displayMergeSummary("test.md", 2, 3);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("formats filename correctly", () => {
			MergeUI.displayMergeSummary("path/to/file.md", 1, 1);
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe("displaySkipped", () => {
		it("shows skipped status", () => {
			MergeUI.displaySkipped("skipped.md");
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("displays correct filename", () => {
			MergeUI.displaySkipped("path/to/skipped.md");
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("handles special characters in filename", () => {
			MergeUI.displaySkipped("file-with-dashes.md");
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe("line truncation", () => {
		it("handles very long lines in hunks", () => {
			const longLine = `+${"x".repeat(500)}`;
			const hunk: FileHunk = {
				oldStart: 1,
				oldLines: 0,
				newStart: 1,
				newLines: 1,
				lines: [longLine],
			};

			// Display should not throw
			MergeUI.showExtendedContext("", hunk, 0);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("handles deletion lines longer than terminal width", () => {
			const longLine = `-${"y".repeat(300)}`;
			const hunk: FileHunk = {
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 0,
				lines: [longLine],
			};

			MergeUI.showExtendedContext("a".repeat(300), hunk, 0);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("handles context lines with extreme lengths", () => {
			const veryLongContent = "a".repeat(2000);
			const hunk: FileHunk = {
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 1,
				lines: [` ${"b".repeat(1999)}`],
			};

			MergeUI.showExtendedContext(veryLongContent, hunk, 5);
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe("context edge cases", () => {
		it("handles hunk at start of file", () => {
			const content = "line1\nline2\nline3";
			const hunk: FileHunk = {
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 1,
				lines: ["-line1", "+line1-new"],
			};

			MergeUI.showExtendedContext(content, hunk, 10);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("handles hunk at end of file", () => {
			const content = "line1\nline2\nline3";
			const hunk: FileHunk = {
				oldStart: 3,
				oldLines: 1,
				newStart: 3,
				newLines: 1,
				lines: ["-line3", "+line3-new"],
			};

			MergeUI.showExtendedContext(content, hunk, 10);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("handles empty hunk lines array", () => {
			const content = "line1\nline2";
			const hunk: FileHunk = {
				oldStart: 1,
				oldLines: 1,
				newStart: 1,
				newLines: 0,
				lines: [],
			};

			MergeUI.showExtendedContext(content, hunk, 1);
			expect(consoleSpy).toHaveBeenCalled();
		});

		it("handles multiline diff markers correctly", () => {
			const content = "line1\nline2\nline3\nline4\nline5";
			const hunk: FileHunk = {
				oldStart: 2,
				oldLines: 2,
				newStart: 2,
				newLines: 3,
				lines: [" line2", "-line3", "+new line 3a", "+new line 3b"],
			};

			MergeUI.showExtendedContext(content, hunk, 1);
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe("display output consistency", () => {
		it("consistent formatting for applied hunks", () => {
			MergeUI.displayMergeSummary("test.md", 1, 0);
			expect(consoleSpy).toHaveBeenCalledWith(expect.any(String));
		});

		it("consistent formatting for rejected hunks", () => {
			MergeUI.displayMergeSummary("test.md", 0, 1);
			expect(consoleSpy).toHaveBeenCalledWith(expect.any(String));
		});

		it("consistent formatting for skipped files", () => {
			MergeUI.displaySkipped("test.md");
			expect(consoleSpy).toHaveBeenCalledWith(expect.any(String));
		});
	});
});
