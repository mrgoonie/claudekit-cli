import { describe, expect, it } from "bun:test";
import {
	type DirectoryItem,
	filterItemsByPatterns,
	getClaudeKitDirectories,
	scanDirectoryTree,
} from "@/services/file-operations/directory-selector.js";

describe("Directory Selector", () => {
	describe("scanDirectoryTree", () => {
		it("should handle non-existent directory gracefully", async () => {
			const items = await scanDirectoryTree("./non-existent", "./non-existent", 2);

			expect(Array.isArray(items)).toBe(true);
			expect(items.length).toBe(0);
		});
	});

	describe("filterItemsByPatterns", () => {
		it("should return all items when no patterns provided", () => {
			const items: DirectoryItem[] = [
				{ name: "agents", path: "/agents", type: "directory", relativePath: "agents" },
				{ name: "commands", path: "/commands", type: "directory", relativePath: "commands" },
				{ name: "config.md", path: "/config.md", type: "file", relativePath: "config.md" },
			];

			const filtered = filterItemsByPatterns(items, []);
			expect(filtered).toEqual(items);
		});
	});

	describe("getClaudeKitDirectories", () => {
		it("should return default ClaudeKit directories", () => {
			const directories = getClaudeKitDirectories();

			expect(Array.isArray(directories)).toBe(true);
			expect(directories.length).toBeGreaterThan(0);

			// Should have main categories
			const categories = directories.map((dir) => dir.category);
			expect(categories).toContain("Agents");
			expect(categories).toContain("Commands");
			expect(categories).toContain("Workflows");
			expect(categories).toContain("Skills");

			// Each directory should have pattern and description
			directories.forEach((dir) => {
				expect(dir).toHaveProperty("category");
				expect(dir).toHaveProperty("pattern");
				expect(dir).toHaveProperty("description");
				expect(typeof dir.pattern).toBe("string");
				expect(typeof dir.description).toBe("string");
			});
		});
	});
});
