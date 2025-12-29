/**
 * Detailed analysis of empty line handling
 */
import { describe, expect, it } from "bun:test";
import { SyncEngine } from "@/domains/sync/sync-engine.js";

describe("Empty Line Handling Analysis", () => {
	it("inspects how diff library represents empty lines", () => {
		const currentContent = "line1\n\nline3";
		const newContent = "line1\n\nline3\nline4";

		const hunks = SyncEngine.generateHunks(currentContent, newContent, "test.txt");

		console.log("\n=== Analyzing Hunk Structure ===");
		hunks.forEach((hunk, i) => {
			console.log(`\nHunk ${i}:`);
			console.log(`  oldStart: ${hunk.oldStart}, oldLines: ${hunk.oldLines}`);
			console.log(`  newStart: ${hunk.newStart}, newLines: ${hunk.newLines}`);
			console.log(`  lines count: ${hunk.lines.length}`);

			hunk.lines.forEach((line, j) => {
				const len = line.length;
				const prefix = len > 0 ? line[0] : "EMPTY";
				const content = len > 1 ? line.slice(1) : "";

				console.log(`  [${j}] len=${len} prefix="${prefix}" content="${content}"`);

				// Check specific case: space-only line (empty line in file)
				if (line === " ") {
					console.log("       ^^^ SPACE-ONLY LINE - represents empty line in original file");
				}
			});
		});

		// Now test manual application
		const result = SyncEngine.applyHunks(currentContent, hunks, [true]);

		console.log("\n=== Verification ===");
		console.log("Expected:", JSON.stringify(newContent));
		console.log("Got:     ", JSON.stringify(result));

		const match = result === newContent;
		console.log("Match:   ", match ? "✅ PASS" : "❌ FAIL");

		expect(result).toBe(newContent);
	});

	it("tests the specific problematic code path", () => {
		const currentContent = "line1\n\nline3";

		const hunks = SyncEngine.generateHunks(currentContent, "line1\n\nline3\nline4", "test.txt");

		// Manually trace through applyHunksManually logic
		const lines = currentContent.split("\n");
		console.log("\n=== Initial lines array ===");
		console.log(lines.map((l, i) => `[${i}] "${l}"`));

		const hunk = hunks[0];
		console.log("\n=== Processing hunk ===");

		let deleteCount = 0;
		const newLines: string[] = [];

		for (const line of hunk.lines) {
			console.log(`Processing: len=${line.length} val="${line}"`);

			// THIS IS THE PROBLEMATIC CODE
			if (!line || line.length === 0) {
				console.log("  → SKIPPED (empty)");
				continue;
			}

			const prefix = line[0];
			const lineContent = line.slice(1);

			console.log(`  → prefix="${prefix}" content="${lineContent}"`);

			if (prefix === "-") {
				deleteCount++;
				console.log(`  → DELETE (count now ${deleteCount})`);
			} else if (prefix === "+" || prefix === " ") {
				newLines.push(lineContent);
				console.log(`  → ADD/KEEP: "${lineContent}"`);
			}
		}

		console.log("\n=== Result ===");
		console.log(`Delete count: ${deleteCount}`);
		console.log(`New lines: ${newLines.map((l) => `"${l}"`).join(", ")}`);
	});

	it("confirms the bug: empty string after slice(1) on space-only line", () => {
		const spaceLine = " "; // This is what diff library generates for empty line

		console.log("\n=== Testing space-only line ===");
		console.log(`Input: "${spaceLine}" (length ${spaceLine.length})`);

		if (!spaceLine || spaceLine.length === 0) {
			console.log("Would be skipped by current code");
		} else {
			const prefix = spaceLine[0];
			const content = spaceLine.slice(1);
			console.log(`Prefix: "${prefix}"`);
			console.log(`Content: "${content}" (length ${content.length})`);

			// This is what gets added to newLines
			console.log(`Result: Empty line is preserved as: "${content}"`);
		}

		// The issue: " " has length 1, so it's NOT skipped
		// After slice(1), we get "", which IS an empty string
		// So empty lines are actually preserved correctly!
		expect(spaceLine.length).toBe(1);
		expect(spaceLine.slice(1)).toBe("");
	});
});
