import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	copyHooksCompanionDirs,
	discoverConfig,
	discoverHooks,
	discoverRules,
	getConfigSourcePath,
	getHooksSourcePath,
	getRulesSourcePath,
	resolveSourceOrigin,
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

		it("prefers CWD/CLAUDE.md over global when it exists", () => {
			// Test runner CWD has a CLAUDE.md at project root — should return it
			const path = getConfigSourcePath();
			const cwd = process.cwd();
			// Path should be under CWD, not under home ~/.claude/
			expect(path.startsWith(cwd)).toBe(true);
		});

		it("uses layout-aware claude/CLAUDE.md when package metadata opts in", () => {
			const projectDir = join(testDir, "layout-aware-config");
			const originalCwd = process.cwd();
			mkdirSync(join(projectDir, "claude"), { recursive: true });
			writeFileSync(
				join(projectDir, "package.json"),
				JSON.stringify({
					claudekit: {
						sourceDir: "claude",
						runtimeDir: ".claude",
					},
				}),
			);
			writeFileSync(join(projectDir, "claude", "CLAUDE.md"), "# Layout Config");

			process.chdir(projectDir);
			try {
				expect(getConfigSourcePath()).toBe(realpathSync(join(projectDir, "claude", "CLAUDE.md")));
			} finally {
				process.chdir(originalCwd);
			}
		});
	});

	describe("getRulesSourcePath", () => {
		it("returns path ending in rules", () => {
			const path = getRulesSourcePath();
			expect(path).toMatch(/rules$/);
		});

		it("prefers layout-aware claude/rules when package metadata opts in", () => {
			const projectDir = join(testDir, "layout-aware-rules");
			const originalCwd = process.cwd();
			mkdirSync(join(projectDir, "claude", "rules"), { recursive: true });
			writeFileSync(
				join(projectDir, "package.json"),
				JSON.stringify({
					claudekit: {
						sourceDir: "claude",
						runtimeDir: ".claude",
					},
				}),
			);

			process.chdir(projectDir);
			try {
				expect(getRulesSourcePath()).toBe(realpathSync(join(projectDir, "claude", "rules")));
			} finally {
				process.chdir(originalCwd);
			}
		});
	});

	describe("getHooksSourcePath", () => {
		it("returns path ending in hooks", () => {
			const path = getHooksSourcePath();
			expect(path).toMatch(/hooks$/);
		});

		it("prefers layout-aware claude/hooks when package metadata opts in", () => {
			const projectDir = join(testDir, "layout-aware-hooks");
			const originalCwd = process.cwd();
			mkdirSync(join(projectDir, "claude", "hooks"), { recursive: true });
			writeFileSync(
				join(projectDir, "package.json"),
				JSON.stringify({
					claudekit: {
						sourceDir: "claude",
						runtimeDir: ".claude",
					},
				}),
			);

			process.chdir(projectDir);
			try {
				expect(getHooksSourcePath()).toBe(realpathSync(join(projectDir, "claude", "hooks")));
			} finally {
				process.chdir(originalCwd);
			}
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

		it("skips symlinked rule files", async () => {
			const rulesDir = join(testDir, "rules-symlink");
			const externalRule = join(testDir, "external-rule.md");
			mkdirSync(rulesDir, { recursive: true });
			writeFileSync(externalRule, "# External Rule");
			writeFileSync(join(rulesDir, "local-rule.md"), "# Local Rule");

			const linkPath = join(rulesDir, "linked-rule.md");
			try {
				symlinkSync(externalRule, linkPath);
			} catch {
				// Symlink creation may be blocked on some environments (for example Windows without privileges).
				return;
			}

			const results = await discoverRules(rulesDir);
			const names = results.map((item) => item.name).sort();
			expect(names).toContain("local-rule");
			expect(names).not.toContain("linked-rule");
		});
	});

	describe("resolveSourceOrigin", () => {
		it("returns global for null path", () => {
			expect(resolveSourceOrigin(null)).toBe("global");
		});

		it("returns global for home directory paths", () => {
			// Also covers the cwd===home edge case: when test CWD is not home (typical),
			// any home-prefixed path resolves to global regardless of CWD.
			expect(resolveSourceOrigin(join(homedir(), ".claude", "agents"))).toBe("global");
		});

		it("returns project for CWD-prefixed paths", () => {
			// Use join() for cross-platform path construction (Windows uses backslash)
			expect(resolveSourceOrigin(join(process.cwd(), ".claude", "skills"))).toBe("project");
		});

		it("avoids substring false positive on similar directory names", () => {
			// A path that shares a prefix but is a different directory
			expect(resolveSourceOrigin(`${process.cwd()}-other`)).toBe("global");
		});

		it("returns project when path equals CWD exactly", () => {
			expect(resolveSourceOrigin(process.cwd())).toBe("project");
		});

		it("returns global for paths outside CWD even if under home", () => {
			// Paths under home but not under CWD resolve to global
			expect(resolveSourceOrigin(join(homedir(), "some-other-project", ".claude", "rules"))).toBe(
				"global",
			);
		});
	});

	describe("discoverHooks", () => {
		it("discovers node-runnable hook extensions and skips shell/non-hook files", async () => {
			const hooksDir = join(testDir, "hooks-multi");
			mkdirSync(hooksDir, { recursive: true });
			writeFileSync(join(hooksDir, "session-init.cjs"), "console.log('init');");
			writeFileSync(join(hooksDir, "cleanup.mjs"), "export default () => {};");
			writeFileSync(join(hooksDir, "validator.ts"), "export const v = 1;");
			writeFileSync(join(hooksDir, "legacy.js"), "module.exports = {}");
			writeFileSync(join(hooksDir, "notify.sh"), "echo hi");
			writeFileSync(join(hooksDir, "ignored.md"), "# not a hook script");

			const { items, skippedShellHooks } = await discoverHooks(hooksDir);

			expect(items).toHaveLength(4);
			expect(items.map((r) => r.name).sort()).toEqual([
				"cleanup.mjs",
				"legacy.js",
				"session-init.cjs",
				"validator.ts",
			]);
			expect(items.every((r) => r.type === "hooks")).toBe(true);
			expect(skippedShellHooks).toContain("notify.sh");
		});

		it("skips subdirectories (hooks are top-level only)", async () => {
			const hooksDir = join(testDir, "hooks-nested");
			mkdirSync(join(hooksDir, "nested"), { recursive: true });
			mkdirSync(join(hooksDir, ".hidden"), { recursive: true });
			writeFileSync(join(hooksDir, "top-level.cjs"), "module.exports = {}");
			writeFileSync(join(hooksDir, "nested", "cleanup.ps1"), "Write-Host cleanup");
			writeFileSync(join(hooksDir, ".hidden", "secret.sh"), "echo nope");

			const { items } = await discoverHooks(hooksDir);

			expect(items).toHaveLength(1);
			expect(items[0].name).toBe("top-level.cjs");
		});

		it("returns empty result for nonexistent hooks directory", async () => {
			const missingDir = join(testDir, "hooks-missing");
			const result = await discoverHooks(missingDir);
			expect(result).toEqual({ items: [], skippedShellHooks: [] });
		});

		it("continues discovery when one hook file cannot be read", async () => {
			const hooksDir = join(testDir, "hooks-unreadable");
			const readableHook = join(hooksDir, "readable.cjs");
			const maybeUnreadableHook = join(hooksDir, "restricted.cjs");
			mkdirSync(hooksDir, { recursive: true });
			writeFileSync(readableHook, "console.log('ok');");
			writeFileSync(maybeUnreadableHook, "console.log('restricted');");

			let permissionsChanged = false;
			try {
				chmodSync(maybeUnreadableHook, 0);
				permissionsChanged = true;
			} catch {
				permissionsChanged = false;
			}

			try {
				const { items } = await discoverHooks(hooksDir);
				expect(items.some((item) => item.name === "readable.cjs")).toBe(true);
			} finally {
				if (permissionsChanged) {
					chmodSync(maybeUnreadableHook, 0o644);
				}
			}
		});
	});

	// Regression test for GH-741: companion dirs (lib/, scout-block/) and .ckignore
	// must be copied alongside hook scripts so require('./lib/*.cjs') resolves correctly.
	describe("copyHooksCompanionDirs", () => {
		it("copies lib/ and scout-block/ subdirectories to the target dir", async () => {
			const src = join(testDir, "companion-src-dirs");
			const dst = join(testDir, "companion-dst-dirs");

			mkdirSync(join(src, "lib"), { recursive: true });
			mkdirSync(join(src, "scout-block"), { recursive: true });
			writeFileSync(join(src, "lib", "colors.cjs"), "module.exports = {};");
			writeFileSync(join(src, "lib", "hook-logger.cjs"), "module.exports = {};");
			writeFileSync(join(src, "scout-block", "pattern-matcher.cjs"), "module.exports = {};");
			// Top-level hook file — should NOT be copied by companion copy (handled by installPerFile)
			writeFileSync(join(src, "session-init.cjs"), "module.exports = {};");

			const result = await copyHooksCompanionDirs(src, dst);

			expect(result.copiedDirs).toContain("lib");
			expect(result.copiedDirs).toContain("scout-block");
			expect(result.errors).toHaveLength(0);

			// Verify files exist at target
			expect(existsSync(join(dst, "lib", "colors.cjs"))).toBe(true);
			expect(existsSync(join(dst, "lib", "hook-logger.cjs"))).toBe(true);
			expect(existsSync(join(dst, "scout-block", "pattern-matcher.cjs"))).toBe(true);
			// Top-level hook should NOT have been copied by companion copy
			expect(existsSync(join(dst, "session-init.cjs"))).toBe(false);
		});

		it("copies .ckignore from source parent to target parent (scout-block layout)", async () => {
			// scout-block resolves .ckignore via path.dirname(__dirname), i.e. one
			// level up from hooks/. Mirror that layout: .ckignore lives at the
			// provider root (~/.claude/.ckignore → ~/.codex/.ckignore), NOT inside hooks/.
			const providerSrcRoot = join(testDir, "parent-ckignore-src-root");
			const providerDstRoot = join(testDir, "parent-ckignore-dst-root");
			const src = join(providerSrcRoot, "hooks");
			const dst = join(providerDstRoot, "hooks");

			mkdirSync(src, { recursive: true });
			mkdirSync(providerDstRoot, { recursive: true });
			// .ckignore lives at the PARENT of hooks/, not inside hooks/
			writeFileSync(join(providerSrcRoot, ".ckignore"), "!node_modules\n!dist\n");

			const result = await copyHooksCompanionDirs(src, dst);

			expect(result.copiedDotfiles).toContain(".ckignore");
			expect(result.errors).toHaveLength(0);
			expect(existsSync(join(providerDstRoot, ".ckignore"))).toBe(true);
			// Should NOT be written inside hooks/
			expect(existsSync(join(dst, ".ckignore"))).toBe(false);
		});

		it("excludes __tests__ and tests directories", async () => {
			const src = join(testDir, "companion-src-skip-tests");
			const dst = join(testDir, "companion-dst-skip-tests");

			mkdirSync(join(src, "__tests__"), { recursive: true });
			mkdirSync(join(src, "tests"), { recursive: true });
			mkdirSync(join(src, "lib"), { recursive: true });
			writeFileSync(join(src, "__tests__", "hook.test.cjs"), "test('noop', () => {});");
			writeFileSync(join(src, "tests", "hook.test.cjs"), "test('noop', () => {});");
			writeFileSync(join(src, "lib", "utils.cjs"), "module.exports = {};");

			const result = await copyHooksCompanionDirs(src, dst);

			expect(result.copiedDirs).toEqual(["lib"]);
			expect(existsSync(join(dst, "__tests__"))).toBe(false);
			expect(existsSync(join(dst, "tests"))).toBe(false);
			expect(existsSync(join(dst, "lib", "utils.cjs"))).toBe(true);
		});

		it("is a no-op when source equals target (same-path guard)", async () => {
			const src = join(testDir, "companion-same-path");
			mkdirSync(join(src, "lib"), { recursive: true });
			writeFileSync(join(src, "lib", "utils.cjs"), "module.exports = {};");

			const result = await copyHooksCompanionDirs(src, src);

			expect(result.copiedDirs).toHaveLength(0);
			expect(result.copiedDotfiles).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});

		it("returns empty result for nonexistent source directory", async () => {
			const src = join(testDir, "companion-src-missing-xyz");
			const dst = join(testDir, "companion-dst-missing-xyz");

			const result = await copyHooksCompanionDirs(src, dst);

			expect(result.copiedDirs).toHaveLength(0);
			expect(result.copiedDotfiles).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});

		it("does not copy hidden directories (e.g. .logs)", async () => {
			const src = join(testDir, "companion-src-hidden");
			const dst = join(testDir, "companion-dst-hidden");

			mkdirSync(join(src, ".logs"), { recursive: true });
			mkdirSync(join(src, "lib"), { recursive: true });
			writeFileSync(join(src, ".logs", "debug.log"), "some log");
			writeFileSync(join(src, "lib", "utils.cjs"), "module.exports = {};");

			const result = await copyHooksCompanionDirs(src, dst);

			expect(result.copiedDirs).toEqual(["lib"]);
			expect(existsSync(join(dst, ".logs"))).toBe(false);
		});

		it("is idempotent — calling twice produces the same result with no errors", async () => {
			// Second invocation on same src/dst should be a no-op overwrite.
			// Users may re-run `ck migrate` repeatedly; companion copy must be safe.
			const providerSrcRoot = join(testDir, "companion-idempotent-src");
			const providerDstRoot = join(testDir, "companion-idempotent-dst");
			const src = join(providerSrcRoot, "hooks");
			const dst = join(providerDstRoot, "hooks");

			mkdirSync(join(src, "lib"), { recursive: true });
			mkdirSync(join(src, "scout-block"), { recursive: true });
			writeFileSync(join(src, "lib", "utils.cjs"), "module.exports = {};");
			writeFileSync(join(src, "scout-block", "fmt.cjs"), "module.exports = {};");
			writeFileSync(join(providerSrcRoot, ".ckignore"), "!dist\n");

			const first = await copyHooksCompanionDirs(src, dst);
			const second = await copyHooksCompanionDirs(src, dst);

			expect(first.copiedDirs.sort()).toEqual(["lib", "scout-block"]);
			expect(first.copiedDotfiles).toContain(".ckignore");
			expect(first.errors).toHaveLength(0);

			// Second invocation reports same results (no duplicates, no errors)
			expect(second.copiedDirs.sort()).toEqual(["lib", "scout-block"]);
			expect(second.copiedDotfiles).toContain(".ckignore");
			expect(second.errors).toHaveLength(0);

			// Target content unchanged after second call
			expect(existsSync(join(dst, "lib", "utils.cjs"))).toBe(true);
			expect(existsSync(join(dst, "scout-block", "fmt.cjs"))).toBe(true);
			expect(existsSync(join(providerDstRoot, ".ckignore"))).toBe(true);
		});
	});
});
