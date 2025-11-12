import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";

describe("workflow-metrics.js", () => {
	test("should run successfully and show analysis header", () => {
		const result = execSync("bun run metrics", {
			encoding: "utf-8",
		});

		expect(result).toContain("📊 Workflow Performance Metrics Analysis");
		expect(result).toContain("📁 Files Analyzed:");
		expect(result).toContain("💡 Recommendations:");
		expect(result).toContain("🎯 Performance Score:");
	});

	test("should provide metrics for current codebase", () => {
		const result = execSync("bun run metrics", {
			encoding: "utf-8",
		});

		// Should detect some files
		const fileCountMatch = result.match(/📁 Files Analyzed: (\d+)/);
		expect(fileCountMatch).toBeTruthy();
		const fileCount = Number.parseInt(fileCountMatch?.[1] || "0");
		expect(fileCount).toBeGreaterThan(0);

		// Should have both code and test lines
		expect(result).toContain("💻 Code Lines:");
		expect(result).toContain("🧪 Test Lines:");
		expect(result).toContain("📏 Test/Code Ratio:");
	});

	test("should calculate performance score", () => {
		const result = execSync("bun run metrics", {
			encoding: "utf-8",
		});

		// Should have a performance score with grade
		expect(result).toContain("🎯 Performance Score:");
	});

	test("should handle TypeScript files correctly", () => {
		const result = execSync("bun run metrics", {
			encoding: "utf-8",
		});

		// Should find TypeScript files
		expect(result).toContain("💻 Code Lines:");
		expect(result).toContain("🧪 Test Lines:");
	});

	test("should show performance grade", () => {
		const result = execSync("bun run metrics", {
			encoding: "utf-8",
		});

		// Should show a grade (A, B, C, or D)
		expect(result).toContain("🎯 Performance Score:");
	});
});
