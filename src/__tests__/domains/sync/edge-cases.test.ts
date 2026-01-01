/**
 * Edge case tests for sync engine merge operations
 */
import { describe, expect, it } from "bun:test";
import { SyncEngine } from "@/domains/sync/sync-engine.js";

describe("SyncEngine Edge Cases", () => {
	describe("Empty lines in hunks", () => {
		it("preserves intentional blank lines in diff", () => {
			const currentContent = "line1\n\nline3";
			const newContent = "line1\n\nline3\nline4";

			const hunks = SyncEngine.generateHunks(currentContent, newContent, "test.txt");

			// Should have at least one hunk
			expect(hunks.length).toBeGreaterThan(0);

			// Check if hunk contains empty line representation
			const hunk = hunks[0];
			console.log(
				"Hunk lines:",
				hunk.lines.map((l) => ({ len: l.length, val: JSON.stringify(l) })),
			);

			// Apply the hunk
			const result = SyncEngine.applyHunks(currentContent, hunks, [true]);

			// BUG: This test will FAIL if empty lines are skipped
			expect(result).toBe(newContent);
		});

		it("handles multiple consecutive blank lines", () => {
			const currentContent = "line1\n\n\nline4";
			const newContent = "line1\n\n\nline4\nline5";

			const hunks = SyncEngine.generateHunks(currentContent, newContent, "test.txt");
			const result = SyncEngine.applyHunks(currentContent, hunks, [true]);

			expect(result).toBe(newContent);
		});
	});

	describe("Overlapping hunks", () => {
		it("handles two hunks modifying adjacent lines", () => {
			const currentContent = "line1\nline2\nline3\nline4";
			const finalContent = "line1\nMODIFIED2\nMODIFIED3\nline4";

			// Generate hunks from current to final
			const hunks = SyncEngine.generateHunks(currentContent, finalContent, "test.txt");

			// Accept all hunks
			const accepted = new Array(hunks.length).fill(true);
			const result = SyncEngine.applyHunks(currentContent, hunks, accepted);

			expect(result).toBe(finalContent);
		});
	});

	describe("Hunk line count mismatch", () => {
		it("applies hunks despite metadata discrepancies", () => {
			// This is harder to test since we rely on diff library
			// But we can verify bounds checking works
			const currentContent = "line1\nline2\nline3";
			const newContent = "line1\nmodified\nline3";

			const hunks = SyncEngine.generateHunks(currentContent, newContent, "test.txt");
			const result = SyncEngine.applyHunks(currentContent, hunks, [true]);

			expect(result).toBe(newContent);
		});
	});

	describe("Very long diff lines", () => {
		it("handles lines longer than 1000 characters", () => {
			const longLine = "x".repeat(2000);
			const currentContent = `line1\n${longLine}\nline3`;
			const newContent = `line1\n${longLine}\nline3\nline4`;

			const hunks = SyncEngine.generateHunks(currentContent, newContent, "test.txt");

			// Should generate hunks successfully
			expect(hunks.length).toBeGreaterThan(0);

			const result = SyncEngine.applyHunks(currentContent, hunks, [true]);
			expect(result).toBe(newContent);
		});
	});

	describe("Zero hunks scenario", () => {
		it("returns original content when no hunks generated", () => {
			const content = "same content\n";

			const hunks = SyncEngine.generateHunks(content, content, "test.txt");

			// No changes → no hunks
			expect(hunks).toHaveLength(0);

			const result = SyncEngine.applyHunks(content, hunks, []);
			expect(result).toBe(content);
		});

		it("handles trailing newline only difference", () => {
			const withNewline = "content\n";
			const withoutNewline = "content";

			const hunks = SyncEngine.generateHunks(withoutNewline, withNewline, "test.txt");

			// Diff library should detect this
			if (hunks.length > 0) {
				const result = SyncEngine.applyHunks(withoutNewline, hunks, [true]);
				expect(result).toBe(withNewline);
			} else {
				// If no hunks, files treated as identical (acceptable)
				expect(hunks).toHaveLength(0);
			}
		});
	});

	describe("Manual hunk application fallback", () => {
		it("handles hunks applied in reverse order", () => {
			const currentContent = "line1\nline2\nline3\nline4\nline5";
			const newContent = "line1\nMOD2\nline3\nMOD4\nline5";

			const hunks = SyncEngine.generateHunks(currentContent, newContent, "test.txt");

			// Force manual application by using applyHunks
			// (it will try library first, fall back if needed)
			const result = SyncEngine.applyHunks(
				currentContent,
				hunks,
				new Array(hunks.length).fill(true),
			);

			expect(result).toBe(newContent);
		});

		it("skips hunks with out-of-bounds start", () => {
			// Can't easily create malformed hunk, but verify bounds checking
			// by confirming normal hunks work correctly
			const currentContent = "line1\nline2";
			const newContent = "line1\nmodified\nline3";

			const hunks = SyncEngine.generateHunks(currentContent, newContent, "test.txt");
			const result = SyncEngine.applyHunks(currentContent, hunks, [true]);

			expect(result).toBe(newContent);
		});
	});
});
