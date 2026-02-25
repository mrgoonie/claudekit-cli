/**
 * Tests for md-strip converter
 */
import { describe, expect, it } from "bun:test";
import {
	convertMdStrip,
	stripClaudeRefs,
	truncateAtCleanBoundary,
} from "../converters/md-strip.js";
import type { PortableItem } from "../types.js";

/** Helper to build test PortableItem */
function makeItem(body: string, name = "test"): PortableItem {
	return {
		name,
		description: "test",
		type: "config",
		sourcePath: "/test",
		frontmatter: {},
		body,
	};
}

describe("stripClaudeRefs", () => {
	describe("tool name replacement", () => {
		it("should replace Read tool references", () => {
			const result = stripClaudeRefs("Use the Read tool to view files");
			expect(result.content).toBe("Use file reading to view files");
		});

		it("should replace Write tool references", () => {
			const result = stripClaudeRefs("Use Write to create files");
			expect(result.content).toBe("use file writing to create files");
		});

		it("should replace Edit tool references", () => {
			const result = stripClaudeRefs("The Edit tool modifies files");
			expect(result.content).toBe("file editing modifies files");
		});

		it("should replace Bash tool references", () => {
			const result = stripClaudeRefs("Use Bash for terminal commands");
			expect(result.content).toBe("use terminal/shell for terminal commands");
		});

		it("should replace Grep tool references", () => {
			const result = stripClaudeRefs("The Grep tool searches code");
			expect(result.content).toBe("code search searches code");
		});

		it("should replace Glob tool references", () => {
			const result = stripClaudeRefs("Use Glob to find files");
			expect(result.content).toBe("use file search to find files");
		});

		it("should replace Task tool references", () => {
			const result = stripClaudeRefs("The Task tool delegates subtasks");
			expect(result.content).toBe("subtask delegation delegates subtasks");
		});

		it("should replace WebFetch and WebSearch references", () => {
			const result = stripClaudeRefs("Use WebFetch and WebSearch for web access");
			expect(result.content).toBe("Use web access and web access for web access");
		});

		it("should replace NotebookEdit references", () => {
			const result = stripClaudeRefs("Use NotebookEdit for notebooks");
			expect(result.content).toBe("Use notebook editing for notebooks");
		});

		it("should handle multiple tool references in one line", () => {
			const result = stripClaudeRefs("Use the Read tool, Write tool, and Bash tool");
			expect(result.content).toBe("Use file reading, file writing, and terminal/shell");
		});

		it("should be case-insensitive for tool names", () => {
			const result = stripClaudeRefs("Use the read tool and GREP TOOL");
			expect(result.content).toBe("Use file reading and code search");
		});
	});

	describe("slash command stripping", () => {
		it("should remove slash commands", () => {
			const result = stripClaudeRefs("Use /commit to save changes");
			expect(result.content).toBe("Use  to save changes");
		});

		it("should remove multiple slash commands", () => {
			const result = stripClaudeRefs("Try /fix and /test commands");
			expect(result.content).toBe("Try  and  commands");
		});

		it("should preserve trailing punctuation when removing slash commands", () => {
			const result = stripClaudeRefs("Run /commit, then /fix.");
			expect(result.content).toBe("Run , then .");
		});

		it("should preserve URL paths", () => {
			const result = stripClaudeRefs("Visit https://api.example.com/users/123");
			expect(result.content).toBe("Visit https://api.example.com/users/123");
		});

		it("should preserve /api/ paths", () => {
			const result = stripClaudeRefs("Check /api/users endpoint");
			expect(result.content).toBe("Check /api/users endpoint");
		});

		it("should preserve /src/ paths", () => {
			const result = stripClaudeRefs("File located at /src/main.ts");
			expect(result.content).toBe("File located at /src/main.ts");
		});

		it("should preserve /home/ paths", () => {
			const result = stripClaudeRefs("Config at /home/user/.config");
			expect(result.content).toBe("Config at /home/user/.config");
		});

		it("should preserve /Users/ paths", () => {
			const result = stripClaudeRefs("Project at /Users/kai/project");
			expect(result.content).toBe("Project at /Users/kai/project");
		});

		it("should preserve /var/ and /etc/ paths", () => {
			const result = stripClaudeRefs("Logs at /var/log and config at /etc/nginx");
			expect(result.content).toBe("Logs at /var/log and config at /etc/nginx");
		});

		it("should preserve custom deep filesystem paths", () => {
			const result = stripClaudeRefs("Inspect /repositories/project/src/index.ts for details");
			expect(result.content).toBe("Inspect /repositories/project/src/index.ts for details");
		});
	});

	describe("path replacement", () => {
		it("should replace .claude/rules/ paths", () => {
			const result = stripClaudeRefs("See .claude/rules/workflow.md");
			expect(result.content).toBe("See project rules directory/workflow.md");
		});

		it("should replace .claude/agents/ paths", () => {
			const result = stripClaudeRefs("Check .claude/agents/planner.md");
			expect(result.content).toBe("Check project subagents directory/planner.md");
		});

		it("should replace .claude/commands/ paths", () => {
			const result = stripClaudeRefs("Run .claude/commands/test.md");
			expect(result.content).toBe("Run project commands directory/test.md");
		});

		it("should replace .claude/skills/ paths", () => {
			const result = stripClaudeRefs("Use .claude/skills/debug.md");
			expect(result.content).toBe("Use project skills directory/debug.md");
		});

		it("should replace CLAUDE.md references", () => {
			const result = stripClaudeRefs("Read CLAUDE.md for instructions");
			expect(result.content).toBe("Read project configuration file for instructions");
		});

		it("should remove .claude/hooks/ references entirely", () => {
			const result = stripClaudeRefs("Hook at .claude/hooks/init.cjs\nNext line");
			expect(result.content).toBe("Next line");
		});

		it("should be case-insensitive for path replacements", () => {
			const result = stripClaudeRefs("See .CLAUDE/RULES/ and claude.MD");
			// Path replacement is case-insensitive, but CLAUDE.md requires \b word boundary and exact case for .md
			expect(result.content).toBe("See project rules directory/ and claude.MD");
		});
	});

	describe("delegation pattern removal", () => {
		it("should remove 'delegate to agent' lines", () => {
			const result = stripClaudeRefs("First line\nDelegate to `tester` agent\nLast line");
			expect(result.content).toBe("First line\n\nLast line");
		});

		it("should remove 'spawn agent' lines", () => {
			const result = stripClaudeRefs("Before\nSpawn researcher agent\nAfter");
			expect(result.content).toBe("Before\n\nAfter");
		});

		it("should remove 'use subagent' lines", () => {
			const result = stripClaudeRefs("Start\nUse code-reviewer subagent\nEnd");
			expect(result.content).toBe("Start\n\nEnd");
		});

		it("should remove 'activate skill' lines", () => {
			const result = stripClaudeRefs("Begin\nActivate debug skill for analysis\nContinue");
			expect(result.content).toBe("Begin\n\nContinue");
		});

		it("should handle multiple delegation patterns", () => {
			const result = stripClaudeRefs(
				"Line 1\nDelegate to `planner` agent\nLine 2\nSpawn tester agent\nLine 3",
			);
			expect(result.content).toBe("Line 1\n\nLine 2\n\nLine 3");
		});
	});

	describe("section stripping", () => {
		it("should remove sections with 'Hook' in title", () => {
			const input = `# Main
Content
## Hook System
Hook content
## Next Section
More content`;
			const result = stripClaudeRefs(input);
			expect(result.content).toContain("# Main");
			expect(result.content).toContain("## Next Section");
			expect(result.content).not.toContain("## Hook System");
			expect(result.content).not.toContain("Hook content");
			expect(result.removedSections).toContain("Hook System");
		});

		it("should remove sections with 'Agent Team' in title", () => {
			const input = `# Intro
Text
## Agent Team Coordination
Team stuff
## Conclusion
End`;
			const result = stripClaudeRefs(input);
			expect(result.content).toContain("# Intro");
			expect(result.content).toContain("## Conclusion");
			expect(result.content).not.toContain("Agent Team");
			expect(result.removedSections).toContain("Agent Team Coordination");
		});

		it("should remove sections until next heading of same or higher level", () => {
			const input = `# Main
Content
## Hook Section
Hook line 1
Hook line 2
### Nested Hook
Nested content
## Next Section
Safe content`;
			const result = stripClaudeRefs(input);
			expect(result.content).toContain("# Main");
			expect(result.content).toContain("## Next Section");
			expect(result.content).not.toContain("Hook line 1");
			expect(result.content).not.toContain("Nested Hook");
		});

		it("should remove lines with SendMessage, TaskCreate, TaskUpdate", () => {
			const input = `Use SendMessage to communicate
TaskCreate for new tasks
Normal line
TaskUpdate to modify tasks`;
			const result = stripClaudeRefs(input);
			expect(result.content).toBe("Normal line");
			expect(result.content).not.toContain("SendMessage");
			expect(result.content).not.toContain("TaskCreate");
			expect(result.content).not.toContain("TaskUpdate");
		});

		it("should handle multiple removed sections", () => {
			const input = `# Start
## Hook A
Content A
## Normal
Safe
## Agent Team B
Content B
## End
Final`;
			const result = stripClaudeRefs(input);
			expect(result.removedSections).toEqual(["Hook A", "Agent Team B"]);
			expect(result.content).toContain("## Normal");
			expect(result.content).toContain("## End");
		});
	});

	describe("code block preservation", () => {
		it("should NOT replace tool names inside code blocks", () => {
			const input = "```\nUse the Read tool here\n```\nUse the Read tool outside";
			const result = stripClaudeRefs(input);
			expect(result.content).toContain("```\nUse the Read tool here\n```");
			expect(result.content).toContain("Use file reading outside");
		});

		it("should NOT replace paths inside code blocks", () => {
			const input = "```\n.claude/rules/test.md\n```\nSee .claude/rules/ docs";
			const result = stripClaudeRefs(input);
			expect(result.content).toContain("```\n.claude/rules/test.md\n```");
			expect(result.content).toContain("See project rules directory/ docs");
		});

		it("should NOT remove slash commands inside code blocks", () => {
			const input = "```bash\n/commit message\n```\nRun /commit outside";
			const result = stripClaudeRefs(input);
			expect(result.content).toContain("```bash\n/commit message\n```");
			expect(result.content).toContain("Run  outside");
		});

		it("should handle multiple code blocks", () => {
			const input = "Use Read\n```\nRead tool\n```\nUse Read\n```\nRead tool\n```\nUse Read";
			const result = stripClaudeRefs(input);
			const codeBlockMatches = result.content.match(/Read tool/g);
			expect(codeBlockMatches?.length).toBe(2); // Only in code blocks
			expect(result.content).toContain("use file reading"); // lowercase after replacement
		});
	});

	describe("char limit truncation", () => {
		it("should truncate content when charLimit is exceeded", () => {
			const longContent = "a".repeat(200);
			const result = stripClaudeRefs(longContent, { provider: "windsurf", charLimit: 100 });
			expect(result.content.length).toBeLessThanOrEqual(100);
			expect(result.warnings[0]).toContain("truncated from 200");
			expect(result.warnings[0]).toContain("over 100 limit");
			expect(result.warnings[0]).toContain("[windsurf]");
		});

		it("should NOT truncate content when within charLimit", () => {
			const content = "a".repeat(50);
			const result = stripClaudeRefs(content, { provider: "windsurf", charLimit: 100 });
			expect(result.content.length).toBe(50);
			expect(result.warnings).toEqual([]);
		});

		it("should work without charLimit option", () => {
			const content = "a".repeat(200);
			const result = stripClaudeRefs(content);
			expect(result.content.length).toBe(200);
			expect(result.warnings).toEqual([]);
		});

		it("should truncate at section boundary when content has headings", () => {
			const content = [
				"## Section One",
				"Content for section one.",
				"",
				"## Section Two",
				"Content for section two.",
				"",
				"## Section Three",
				"Content for section three that is quite long.",
			].join("\n");
			const result = stripClaudeRefs(content, { provider: "windsurf", charLimit: 60 });
			// Should remove sections from bottom to fit within limit
			expect(result.content.length).toBeLessThanOrEqual(60);
			expect(result.content).toContain("Section One");
			expect(result.warnings[0]).toContain("removed sections:");
		});

		it("should list removed section names in warning", () => {
			const content = [
				"## Alpha",
				"Short.",
				"",
				"## Beta",
				"Short.",
				"",
				"## Gamma",
				"Short.",
			].join("\n");
			const result = stripClaudeRefs(content, { provider: "windsurf", charLimit: 30 });
			expect(result.warnings[0]).toContain("removed sections:");
		});

		it("should handle content with no sections gracefully", () => {
			const content = `Paragraph one.\n\nParagraph two.\n\nParagraph three that is very long ${"x".repeat(100)}`;
			const result = stripClaudeRefs(content, { provider: "windsurf", charLimit: 50 });
			expect(result.content.length).toBeLessThanOrEqual(50);
			// "Paragraph three..." should be fully absent at 50-char limit
			expect(result.content).not.toContain("x");
		});
	});

	describe("empty result warning", () => {
		it("should warn when all content was Claude-specific", () => {
			const input = "Delegate to `tester` agent\nSpawn researcher agent";
			const result = stripClaudeRefs(input);
			expect(result.content).toBe("");
			expect(result.warnings[0]).toContain("All content was Claude-specific");
		});

		it("should include provider tag in empty content warning", () => {
			const input = "Delegate to `tester` agent\nSpawn researcher agent";
			const result = stripClaudeRefs(input, { provider: "windsurf" });
			expect(result.content).toBe("");
			expect(result.warnings[0]).toContain("[windsurf]");
		});

		it("should NOT warn when some content remains", () => {
			const input = "Normal content\nDelegate to `tester` agent";
			const result = stripClaudeRefs(input);
			expect(result.content).toBe("Normal content");
			expect(result.warnings).toEqual([]);
		});
	});

	describe("idempotency", () => {
		it("should produce same result when called twice", () => {
			const input = "Use the Read tool and delegate to `tester` agent";
			const first = stripClaudeRefs(input);
			const second = stripClaudeRefs(first.content);
			expect(first.content).toBe(second.content);
		});

		it("should be idempotent with multiple transformations", () => {
			const input = `Use Read tool
See .claude/rules/
Delegate to agent
## Hook Section
Hook content
## Normal
Content`;
			const first = stripClaudeRefs(input);
			const second = stripClaudeRefs(first.content);
			const third = stripClaudeRefs(second.content);
			expect(second.content).toBe(third.content);
		});
	});

	describe("URL preservation", () => {
		it("should preserve /api/users/123 as URL", () => {
			const result = stripClaudeRefs("Check /api/users/123 endpoint");
			expect(result.content).toBe("Check /api/users/123 endpoint");
		});

		it("should preserve URLs with ports", () => {
			const result = stripClaudeRefs("Server at http://localhost:3000/api/test");
			expect(result.content).toBe("Server at http://localhost:3000/api/test");
		});

		it("should NOT treat file paths as slash commands", () => {
			const result = stripClaudeRefs("Files: /src/main.ts, /home/user/.config");
			expect(result.content).toBe("Files: /src/main.ts, /home/user/.config");
		});
	});

	describe("mixed content", () => {
		it("should handle lines with both generic and Claude-specific content", () => {
			const input = "Read files using the Read tool in the .claude/agents/ directory";
			const result = stripClaudeRefs(input);
			expect(result.content).toBe(
				"Read files using file reading in the project subagents directory/ directory",
			);
		});

		it("should handle complex mixed scenarios", () => {
			const input = `# Guide

Use the Read tool to check .claude/rules/workflow.md

Run /commit after changes

Normal instructions here

Delegate to \`planner\` agent

## Hook System
Hook content

## Final Section
Conclusion`;
			const result = stripClaudeRefs(input);
			expect(result.content).toContain("# Guide");
			expect(result.content).toContain("file reading"); // lowercase
			expect(result.content).toContain("project rules directory/workflow.md");
			expect(result.content).toContain("Normal instructions here");
			expect(result.content).toContain("## Final Section");
			expect(result.content).not.toContain("Delegate");
			expect(result.content).not.toContain("## Hook System");
		});
	});

	describe("provider-aware delegation stripping", () => {
		it("no provider (default) strips delegation lines", () => {
			const result = stripClaudeRefs("First\nDelegate to `planner` agent\nLast");
			expect(result.content).toBe("First\n\nLast");
		});

		it("provider with subagents: full preserves delegation lines", () => {
			const result = stripClaudeRefs("First\nDelegate to `planner` agent\nLast", {
				provider: "roo",
			});
			expect(result.content).toContain("Delegate to `planner` agent");
		});

		it("provider with subagents: partial preserves delegation lines", () => {
			const result = stripClaudeRefs("First\nSpawn researcher agent\nLast", {
				provider: "codex",
			});
			expect(result.content).toContain("Spawn researcher agent");
		});

		it("provider with subagents: planned preserves delegation lines", () => {
			const result = stripClaudeRefs("First\nActivate debug skill for analysis\nLast", {
				provider: "gemini-cli",
			});
			expect(result.content).toContain("Activate debug skill for analysis");
		});

		it("provider with subagents: none strips delegation lines", () => {
			const result = stripClaudeRefs("First\nDelegate to `planner` agent\nLast", {
				provider: "windsurf",
			});
			expect(result.content).not.toContain("Delegate");
		});

		it("provider with subagents: full preserves Agent Team sections", () => {
			const input = "# Intro\nText\n## Agent Team Coordination\nTeam stuff\n## Conclusion\nEnd";
			const result = stripClaudeRefs(input, { provider: "roo" });
			expect(result.content).toContain("## Agent Team Coordination");
			expect(result.content).toContain("Team stuff");
		});

		it("provider with subagents: none strips Agent Team sections", () => {
			const input = "# Intro\nText\n## Agent Team Coordination\nTeam stuff\n## Conclusion\nEnd";
			const result = stripClaudeRefs(input, { provider: "windsurf" });
			expect(result.content).not.toContain("Agent Team");
		});

		it("hook sections are always removed regardless of subagent support", () => {
			const input = "# Main\nContent\n## Hook System\nHook content\n## Next\nMore";
			const result = stripClaudeRefs(input, { provider: "roo" });
			expect(result.content).not.toContain("## Hook System");
			expect(result.content).not.toContain("Hook content");
			expect(result.removedSections).toContain("Hook System");
		});

		it("SendMessage/TaskCreate/TaskUpdate lines always removed regardless of subagent support", () => {
			const input = "Use SendMessage to communicate\nNormal line\nTaskCreate for tasks";
			const result = stripClaudeRefs(input, { provider: "roo" });
			expect(result.content).toBe("Normal line");
		});
	});

	describe("cleanup behavior", () => {
		it("should remove consecutive blank lines (max 2)", () => {
			const input = "Line 1\n\n\n\n\nLine 2";
			const result = stripClaudeRefs(input);
			expect(result.content).toBe("Line 1\n\nLine 2");
		});

		it("should trim trailing whitespace from lines", () => {
			const input = "Line 1   \nLine 2\t\nLine 3";
			const result = stripClaudeRefs(input);
			expect(result.content).toBe("Line 1\nLine 2\nLine 3");
		});

		it("should trim start and end of content", () => {
			const input = "\n\n  Content  \n\n";
			const result = stripClaudeRefs(input);
			expect(result.content).toBe("Content");
		});
	});
});

describe("convertMdStrip", () => {
	describe("basic conversion", () => {
		it("should return correct filename", () => {
			const item = makeItem("Content", "test-config");
			const result = convertMdStrip(item, "opencode");
			expect(result.filename).toBe("test-config.md");
		});

		it("should strip Claude refs from body", () => {
			const item = makeItem("Use the Read tool and delegate to `tester` agent", "test");
			// OpenCode supports subagents, so delegation lines are preserved
			const result = convertMdStrip(item, "opencode");
			expect(result.content).toBe("Use file reading and delegate to `tester` agent");
		});

		it("should strip delegation for providers without subagent support", () => {
			const item = makeItem("Delegate to `tester` agent", "test");
			const result = convertMdStrip(item, "windsurf");
			expect(result.warnings[0]).toContain("All content was Claude-specific");
			expect(result.warnings[0]).toContain("[windsurf]");
		});
	});

	describe("windsurf charLimit", () => {
		it("should apply charLimit for windsurf config", () => {
			const longContent = "a".repeat(7000);
			const item = makeItem(longContent, "test");
			const result = convertMdStrip(item, "windsurf");
			// windsurf config has charLimit: 6000
			expect(result.content.length).toBeLessThanOrEqual(6000);
			expect(result.warnings[0]).toContain("truncated from 7000");
			expect(result.warnings[0]).toContain("over 6000 limit");
			expect(result.warnings[0]).toContain("[windsurf]");
		});

		it("should NOT apply charLimit for providers without it", () => {
			const longContent = "a".repeat(7000);
			const item = makeItem(longContent, "test");
			const result = convertMdStrip(item, "opencode");
			expect(result.content.length).toBe(7000);
			expect(result.warnings).toEqual([]);
		});
	});

	describe("provider variations", () => {
		it("should work with different providers", () => {
			const item = makeItem("Use Read tool", "test");

			const providers = ["opencode", "goose", "gemini-cli", "amp", "antigravity", "droid"] as const;
			for (const provider of providers) {
				const result = convertMdStrip(item, provider);
				expect(result.content).toBe("Use file reading");
				expect(result.filename).toBe("test.md");
			}
		});

		it("should map CLAUDE paths to provider-specific targets", () => {
			const item = makeItem(
				"See .claude/commands/release.md and .claude/rules/style.md in CLAUDE.md",
				"test",
			);

			const codex = convertMdStrip(item, "codex");
			expect(codex.content).toContain("~/.codex/prompts/release.md");
			expect(codex.content).toContain("AGENTS.md");

			const opencode = convertMdStrip(item, "opencode");
			expect(opencode.content).toContain(".opencode/commands/release.md");
			expect(opencode.content).toContain("AGENTS.md");

			const droid = convertMdStrip(item, "droid");
			expect(droid.content).toContain(".factory/commands/release.md");
			expect(droid.content).toContain("AGENTS.md");
		});
	});

	describe("provider-aware delegation via convertMdStrip", () => {
		it("provider with subagents: full preserves delegation in migrate output", () => {
			const item = makeItem(
				"Step 1: Analyze code\nDelegate to `planner` agent for design\nStep 2: Implement",
				"workflow",
			);
			// Roo has subagents: "full" — delegation lines preserved
			const result = convertMdStrip(item, "roo");
			expect(result.content).toContain("Delegate to `planner` agent for design");
			expect(result.content).toContain("Step 1: Analyze code");
			expect(result.content).toContain("Step 2: Implement");
		});

		it("windsurf (subagents: none) strips delegation in migrate output", () => {
			const item = makeItem(
				"Step 1: Analyze code\nDelegate to `planner` agent for design\nStep 2: Implement",
				"workflow",
			);
			// Windsurf has subagents: "none" — delegation lines removed
			const result = convertMdStrip(item, "windsurf");
			expect(result.content).not.toContain("Delegate");
			expect(result.content).toContain("Step 1: Analyze code");
			expect(result.content).toContain("Step 2: Implement");
		});
	});
});

describe("truncateAtCleanBoundary (direct)", () => {
	it("should return empty string for zero limit", () => {
		const result = truncateAtCleanBoundary("Some content", 0);
		expect(result.result).toBe("");
		expect(result.originalLength).toBe(12);
	});

	it("should return empty string for negative limit", () => {
		const result = truncateAtCleanBoundary("Some content", -5);
		expect(result.result).toBe("");
		expect(result.originalLength).toBe(12);
	});

	it("should return content unchanged when within limit", () => {
		const result = truncateAtCleanBoundary("Short", 100);
		expect(result.result).toBe("Short");
		expect(result.removedSections).toEqual([]);
	});

	it("should remove sections from bottom up", () => {
		const content = "## A\nFirst\n\n## B\nSecond\n\n## C\nThird";
		const result = truncateAtCleanBoundary(content, 25);
		expect(result.result).toContain("## A");
		expect(result.removedSections.length).toBeGreaterThan(0);
		expect(result.result.length).toBeLessThanOrEqual(25);
	});

	it("should fall back to paragraph boundary when no sections", () => {
		const content = `First paragraph.\n\nSecond paragraph.\n\nThird paragraph ${"x".repeat(100)}`;
		const result = truncateAtCleanBoundary(content, 40);
		expect(result.result.length).toBeLessThanOrEqual(40);
		expect(result.removedSections).toEqual([]);
	});

	it("should handle h1-only content (not split into sections)", () => {
		const content = `# Title\nContent\n\n# Another\nMore ${"x".repeat(100)}`;
		const result = truncateAtCleanBoundary(content, 30);
		// h1 headings are not split — falls to paragraph truncation
		expect(result.result.length).toBeLessThanOrEqual(30);
		expect(result.removedSections).toEqual([]);
	});

	it("should handle content where preamble exceeds limit", () => {
		const content = `${"x".repeat(200)}\n\n## Section\nContent`;
		const result = truncateAtCleanBoundary(content, 50);
		expect(result.result.length).toBeLessThanOrEqual(50);
	});
});

describe("convertMdStrip provider coverage", () => {
	it("should work with github-copilot provider", () => {
		const item: PortableItem = {
			name: "test-rule",
			description: "test",
			type: "rules",
			sourcePath: "/test",
			frontmatter: {},
			body: "Use the Read tool to check .claude/rules/workflow.md",
		};
		const result = convertMdStrip(item, "github-copilot");
		expect(result.filename).toBe("test-rule.md");
		expect(result.content).toContain("file reading");
		expect(result.content).not.toContain("Read tool");
	});

	it("should not apply charLimit for github-copilot (no limit set)", () => {
		const item: PortableItem = {
			name: "big-rule",
			description: "test",
			type: "rules",
			sourcePath: "/test",
			frontmatter: {},
			body: "a".repeat(10000),
		};
		const result = convertMdStrip(item, "github-copilot");
		expect(result.content.length).toBe(10000);
		expect(result.warnings).toEqual([]);
	});
});
