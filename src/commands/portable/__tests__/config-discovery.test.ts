import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	discoverConfig,
	discoverHooks,
	discoverRules,
	getConfigSourcePath,
	getHooksSourcePath,
	getRulesSourcePath,
} from "../config-discovery.js";

describe("config-discovery", () => {
	const testDir = join(tmpdir(), "claudekit-config-discovery-test");

	beforeAll(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterAll(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("getConfigSourcePath", () => {
		it("returns path ending in CLAUDE.md", () => {
			const path = getConfigSourcePath();
			expect(path).toMatch(/CLAUDE\.md$/);
		});
	});

	describe("getRulesSourcePath", () => {
		it("returns path ending in rules", () => {
			const path = getRulesSourcePath();
			expect(path).toMatch(/rules$/);
		});
	});

	describe("getHooksSourcePath", () => {
		it("returns path ending in hooks", () => {
			const path = getHooksSourcePath();
			expect(path).toMatch(/hooks$/);
		});
	});

	describe("discoverConfig", () => {
		it("discovers config from valid file", async () => {
			const configPath = join(testDir, "CLAUDE.md");
			writeFileSync(configPath, "# Project Config\n\nTest content");

			const result = await discoverConfig(configPath);

			expect(result).not.toBeNull();
			expect(result?.name).toBe("CLAUDE");
			expect(result?.type).toBe("config");
			expect(result?.body).toContain("# Project Config");
		});

		it("returns null for missing file", async () => {
			const missingPath = join(testDir, "nonexistent.md");
			const result = await discoverConfig(missingPath);

			expect(result).toBeNull();
		});

		it("reads from custom source path", async () => {
			const customPath = join(testDir, "custom-config.md");
			writeFileSync(customPath, "# Custom Config\n\nCustom content");

			const result = await discoverConfig(customPath);

			expect(result).not.toBeNull();
			expect(result?.body).toContain("Custom content");
			expect(result?.sourcePath).toBe(customPath);
		});

		it("does not parse frontmatter (returns raw body)", async () => {
			const configPath = join(testDir, "config-with-frontmatter.md");
			writeFileSync(configPath, "---\nauthor: test\nversion: 1.0\n---\n# Config\n\nContent");

			const result = await discoverConfig(configPath);

			expect(result).not.toBeNull();
			expect(result?.frontmatter).toEqual({});
			expect(result?.body).toContain("---");
			expect(result?.body).toContain("# Config");
		});
	});

	describe("discoverRules", () => {
		it("discovers multiple rule files", async () => {
			const rulesDir = join(testDir, "rules-multi");
			mkdirSync(rulesDir, { recursive: true });
			writeFileSync(join(rulesDir, "rule1.md"), "# Rule 1");
			writeFileSync(join(rulesDir, "rule2.md"), "# Rule 2");

			const results = await discoverRules(rulesDir);

			expect(results).toHaveLength(2);
			expect(results.map((r) => r.name).sort()).toEqual(["rule1", "rule2"]);
			expect(results.every((r) => r.type === "rules")).toBe(true);
		});

		it("handles nested directory structure", async () => {
			const rulesDir = join(testDir, "rules-nested");
			mkdirSync(join(rulesDir, "sub"), { recursive: true });
			writeFileSync(join(rulesDir, "sub", "nested-rule.md"), "# Nested Rule");

			const results = await discoverRules(rulesDir);

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("sub/nested-rule");
			expect(results[0].type).toBe("rules");
		});

		it("returns empty array for empty directory", async () => {
			const emptyDir = join(testDir, "rules-empty");
			mkdirSync(emptyDir, { recursive: true });

			const results = await discoverRules(emptyDir);

			expect(results).toEqual([]);
		});

		it("skips non-markdown files", async () => {
			const rulesDir = join(testDir, "rules-mixed");
			mkdirSync(rulesDir, { recursive: true });
			writeFileSync(join(rulesDir, "rule.md"), "# Rule");
			writeFileSync(join(rulesDir, "ignore.txt"), "Not markdown");
			writeFileSync(join(rulesDir, "data.json"), "{}");

			const results = await discoverRules(rulesDir);

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("rule");
		});

		it("skips dotfiles", async () => {
			const rulesDir = join(testDir, "rules-dotfiles");
			mkdirSync(rulesDir, { recursive: true });
			writeFileSync(join(rulesDir, "visible.md"), "# Visible");
			writeFileSync(join(rulesDir, ".hidden.md"), "# Hidden");

			const results = await discoverRules(rulesDir);

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("visible");
		});

		it("returns empty array for nonexistent directory", async () => {
			const missingDir = join(testDir, "rules-missing");
			const results = await discoverRules(missingDir);

			expect(results).toEqual([]);
		});

		it("preserves rule content (no frontmatter parsing)", async () => {
			const rulesDir = join(testDir, "rules-content");
			mkdirSync(rulesDir, { recursive: true });
			writeFileSync(
				join(rulesDir, "detailed-rule.md"),
				"---\npriority: high\n---\n# Detailed Rule\n\nRule content",
			);

			const results = await discoverRules(rulesDir);

			expect(results).toHaveLength(1);
			expect(results[0].frontmatter).toEqual({});
			expect(results[0].body).toContain("---");
			expect(results[0].body).toContain("# Detailed Rule");
			expect(results[0].body).toContain("Rule content");
		});

		it("handles deeply nested directories", async () => {
			const rulesDir = join(testDir, "rules-deep");
			mkdirSync(join(rulesDir, "level1", "level2", "level3"), {
				recursive: true,
			});
			writeFileSync(join(rulesDir, "level1", "level2", "level3", "deep-rule.md"), "# Deep Rule");

			const results = await discoverRules(rulesDir);

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("level1/level2/level3/deep-rule");
		});
	});

	describe("discoverHooks", () => {
		it("discovers supported hook script extensions and preserves extension in name", async () => {
			const hooksDir = join(testDir, "hooks-multi");
			mkdirSync(hooksDir, { recursive: true });
			writeFileSync(join(hooksDir, "session-init.cjs"), "console.log('init');");
			writeFileSync(join(hooksDir, "post-edit.sh"), "echo hi");
			writeFileSync(join(hooksDir, "ignored.md"), "# not a hook script");

			const results = await discoverHooks(hooksDir);

			expect(results).toHaveLength(2);
			expect(results.map((r) => r.name).sort()).toEqual(["post-edit.sh", "session-init.cjs"]);
			expect(results.every((r) => r.type === "hooks")).toBe(true);
		});

		it("supports nested hook directories and skips hidden entries", async () => {
			const hooksDir = join(testDir, "hooks-nested");
			mkdirSync(join(hooksDir, "nested"), { recursive: true });
			mkdirSync(join(hooksDir, ".hidden"), { recursive: true });
			writeFileSync(join(hooksDir, "nested", "cleanup.ps1"), "Write-Host cleanup");
			writeFileSync(join(hooksDir, ".hidden", "secret.sh"), "echo nope");

			const results = await discoverHooks(hooksDir);

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("nested/cleanup.ps1");
		});

		it("returns empty array for nonexistent hooks directory", async () => {
			const missingDir = join(testDir, "hooks-missing");
			const results = await discoverHooks(missingDir);
			expect(results).toEqual([]);
		});
	});
});
