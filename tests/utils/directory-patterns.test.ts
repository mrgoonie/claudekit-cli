import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { getClaudeKitDirectories } from "../../src/services/file-operations/directory-selector";
import { PathResolver } from "../../src/shared/path-resolver";

describe("Directory Selection Patterns", () => {
	describe("PathResolver Integration", () => {
		it("should generate correct patterns for local mode", () => {
			const directories = getClaudeKitDirectories(false);

			// In local mode, patterns should include .claude prefix
			const expectedPatterns = [
				".claude/**", // Core
				".claude/agents/**", // Agents
				".claude/commands/**", // Commands
				".claude/workflows/**", // Workflows
				".claude/skills/**", // Skills
				".claude/hooks/**", // Hooks
			];

			directories.forEach((dir, index) => {
				expect(dir.pattern).toBe(expectedPatterns[index]);
				expect(dir.description).toBeTruthy();
			});
		});

		it("should generate correct patterns for global mode", () => {
			const directories = getClaudeKitDirectories(true);

			// In global mode, patterns should NOT include .claude prefix
			const expectedPatterns = [
				"**", // Core (all files)
				"agents/**", // Agents
				"commands/**", // Commands
				"workflows/**", // Workflows
				"skills/**", // Skills
				"hooks/**", // Hooks
			];

			directories.forEach((dir, index) => {
				expect(dir.pattern).toBe(expectedPatterns[index]);
				expect(dir.description).toBeTruthy();
			});
		});

		it("should use PathResolver.getPathPrefix correctly", () => {
			// Test local mode prefix
			const localPrefix = PathResolver.getPathPrefix(false);
			expect(localPrefix).toBe(".claude");

			// Test global mode prefix
			const globalPrefix = PathResolver.getPathPrefix(true);
			expect(globalPrefix).toBe("");
		});

		it("should maintain consistency between getPathPrefix and buildComponentPath", () => {
			const baseDir = "/test/project";
			const components = ["agents", "commands", "workflows", "skills", "hooks"];

			// Test local mode
			const localPrefix = PathResolver.getPathPrefix(false);
			components.forEach((component) => {
				const expectedPath = localPrefix
					? join(baseDir, localPrefix, component)
					: join(baseDir, component);
				const actualPath = PathResolver.buildComponentPath(baseDir, component, false);
				expect(actualPath).toBe(expectedPath);
			});

			// Test global mode
			const globalPrefix = PathResolver.getPathPrefix(true);
			components.forEach((component) => {
				const expectedPath = globalPrefix
					? join(baseDir, globalPrefix, component)
					: join(baseDir, component);
				const actualPath = PathResolver.buildComponentPath(baseDir, component, true);
				expect(actualPath).toBe(expectedPath);
			});
		});

		it("should generate correct patterns for promptDirectorySelection logic", () => {
			// This simulates the logic in promptDirectorySelection method
			const testCases = [
				{ global: false, expectedPrefix: ".claude" },
				{ global: true, expectedPrefix: "" },
			];

			testCases.forEach(({ global, expectedPrefix }) => {
				const prefix = PathResolver.getPathPrefix(global);
				expect(prefix).toBe(expectedPrefix);

				// Test the category pattern generation logic from prompts.ts
				const categories = [
					{ key: "agents", pattern: prefix ? `${prefix}/agents` : "agents" },
					{ key: "commands", pattern: prefix ? `${prefix}/commands` : "commands" },
					{ key: "workflows", pattern: prefix ? `${prefix}/workflows` : "workflows" },
					{ key: "skills", pattern: prefix ? `${prefix}/skills` : "skills" },
					{ key: "hooks", pattern: prefix ? `${prefix}/hooks` : "hooks" },
				];

				// Verify local mode patterns
				if (!global) {
					expect(categories[0].pattern).toBe(".claude/agents");
					expect(categories[1].pattern).toBe(".claude/commands");
					expect(categories[2].pattern).toBe(".claude/workflows");
					expect(categories[3].pattern).toBe(".claude/skills");
					expect(categories[4].pattern).toBe(".claude/hooks");
				} else {
					// Verify global mode patterns
					expect(categories[0].pattern).toBe("agents");
					expect(categories[1].pattern).toBe("commands");
					expect(categories[2].pattern).toBe("workflows");
					expect(categories[3].pattern).toBe("skills");
					expect(categories[4].pattern).toBe("hooks");
				}
			});
		});

		it("should handle skills directory path generation correctly", () => {
			const testCases = [
				{ baseDir: "/project", global: false, expected: join("/project", ".claude", "skills") },
				{
					baseDir: "/home/user/.claude",
					global: true,
					expected: join("/home/user/.claude", "skills"),
				},
				{ baseDir: "/tmp/test", global: false, expected: join("/tmp/test", ".claude", "skills") },
			];

			testCases.forEach(({ baseDir, global, expected }) => {
				const actualPath = PathResolver.buildSkillsPath(baseDir, global);
				expect(actualPath).toBe(expected);
			});
		});
	});

	describe("Pattern Matching Scenarios", () => {
		it("should distinguish local vs global patterns correctly", () => {
			const localDirs = getClaudeKitDirectories(false);
			const globalDirs = getClaudeKitDirectories(true);

			// Ensure patterns are different between local and global modes
			localDirs.forEach((localDir, index) => {
				const globalDir = globalDirs[index];
				expect(localDir.pattern).not.toBe(globalDir.pattern);

				// Local patterns should contain .claude prefix (except Core which uses **)
				if (index > 0) {
					// Skip Core (index 0) as it uses different pattern
					expect(localDir.pattern).toContain(".claude/");
				}

				// Global patterns should NOT contain .claude prefix
				expect(globalDir.pattern).not.toContain(".claude/");
			});
		});

		it("should maintain backward compatibility for local mode", () => {
			// Verify that local mode still works exactly as before
			const localPrefix = PathResolver.getPathPrefix(false);
			expect(localPrefix).toBe(".claude");

			// Test that local mode builds paths as expected
			const localSkillsPath = PathResolver.buildSkillsPath("/project", false);
			expect(localSkillsPath).toBe(join("/project", ".claude", "skills"));

			const localAgentsPath = PathResolver.buildComponentPath("/project", "agents", false);
			expect(localAgentsPath).toBe(join("/project", ".claude", "agents"));
		});

		it("should support global mode without prefix", () => {
			// Verify that global mode works without any prefix
			const globalPrefix = PathResolver.getPathPrefix(true);
			expect(globalPrefix).toBe("");

			// Test that global mode builds paths without prefix
			const globalSkillsPath = PathResolver.buildSkillsPath("/home/user/.claude", true);
			expect(globalSkillsPath).toBe(join("/home/user/.claude", "skills"));

			const globalAgentsPath = PathResolver.buildComponentPath(
				"/home/user/.claude",
				"agents",
				true,
			);
			expect(globalAgentsPath).toBe(join("/home/user/.claude", "agents"));
		});
	});
});
