import { describe, expect, it } from "bun:test";
import { convertMdToKiroSteering } from "../converters/md-to-kiro-steering.js";
import type { PortableItem } from "../types.js";

function createMockItem(overrides: Partial<PortableItem> = {}): PortableItem {
	return {
		name: "test-rule",
		type: "rules",
		description: "Test rule",
		sourcePath: "/mock/path/test-rule.md",
		frontmatter: {},
		body: "This is a test rule.",
		...overrides,
	};
}

describe("md-to-kiro-steering", () => {
	describe("YAML frontmatter generation", () => {
		it("adds YAML frontmatter with inclusion: always by default", () => {
			const item = createMockItem();
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("---");
			expect(result.content).toContain("inclusion: always");
		});

		it("quotes fileMatch glob patterns in YAML", () => {
			const item = createMockItem({ name: "typescript-rules" });
			const result = convertMdToKiroSteering(item, "kiro");

			// Glob should be quoted to handle YAML special chars
			expect(result.content).toContain('fileMatch: "**/*.{ts,tsx}"');
		});
	});

	describe("language detection", () => {
		it("detects typescript from name prefix", () => {
			const item = createMockItem({ name: "typescript-conventions" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("inclusion: fileMatch");
			expect(result.content).toContain("**/*.{ts,tsx}");
		});

		it("detects python from name suffix", () => {
			const item = createMockItem({ name: "rules-python" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("inclusion: fileMatch");
			expect(result.content).toContain("**/*.py");
		});

		it("does NOT false positive java from javascript", () => {
			const item = createMockItem({ name: "javascript-style" });
			const result = convertMdToKiroSteering(item, "kiro");

			// Should match javascript, not java
			expect(result.content).toContain("**/*.{js,jsx,mjs,cjs}");
			expect(result.content).not.toContain("**/*.java");
		});

		it("does NOT match partial substrings", () => {
			const item = createMockItem({ name: "trust-rules" });
			const result = convertMdToKiroSteering(item, "kiro");

			// "trust" contains "rust" but shouldn't match
			expect(result.content).toContain("inclusion: always");
			expect(result.content).not.toContain("fileMatch");
		});

		it("matches exact language name", () => {
			const item = createMockItem({ name: "rust" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("inclusion: fileMatch");
			expect(result.content).toContain("**/*.rs");
		});

		it("detects language in middle of name with hyphens", () => {
			const item = createMockItem({ name: "my-python-rules" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("inclusion: fileMatch");
			expect(result.content).toContain("**/*.py");
		});

		it("detects go language correctly", () => {
			const item = createMockItem({ name: "go-conventions" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("inclusion: fileMatch");
			expect(result.content).toContain("**/*.go");
		});
	});

	describe("heading handling", () => {
		it("adds heading from frontmatter name if available", () => {
			const item = createMockItem({
				frontmatter: { name: "Custom Heading" },
				body: "Content without heading.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("# Custom Heading");
		});

		it("falls back to item name for heading", () => {
			const item = createMockItem({
				name: "my-rule",
				body: "Content here.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("# my-rule");
		});

		it("does NOT duplicate heading if body already has one", () => {
			const item = createMockItem({
				name: "my-rule",
				body: "# Existing Heading\n\nContent here.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			// Should not have two headings
			const headingCount = (result.content.match(/^# /gm) || []).length;
			expect(headingCount).toBe(1);
			expect(result.content).toContain("# Existing Heading");
		});

		it("handles body with heading after whitespace", () => {
			const item = createMockItem({
				name: "my-rule",
				body: "\n  # Existing Heading\n\nContent here.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			// Should detect the heading even with leading whitespace
			const headingCount = (result.content.match(/^# /gm) || []).length;
			expect(headingCount).toBe(1);
		});

		it("does NOT duplicate heading if body starts with h2", () => {
			const item = createMockItem({
				name: "my-rule",
				body: "## Existing H2 Section\n\nContent here.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			// Should not inject h1 when h2 exists as top-level
			expect(result.content).not.toContain("# my-rule");
			expect(result.content).toContain("## Existing H2 Section");
		});

		it("does NOT duplicate heading if body starts with h3", () => {
			const item = createMockItem({
				name: "my-rule",
				body: "### Existing H3 Section\n\nContent here.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			// Should not inject h1 when h3 exists as top-level
			expect(result.content).not.toContain("# my-rule");
			expect(result.content).toContain("### Existing H3 Section");
		});
	});

	describe("agent metadata warnings", () => {
		it("warns when agent has model field", () => {
			const item = createMockItem({
				type: "agent",
				frontmatter: { model: "opus" },
			});
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.warnings.some((w) => w.includes("Agent metadata not supported"))).toBe(true);
			expect(result.warnings.some((w) => w.includes("model"))).toBe(true);
		});

		it("warns when agent has tools field", () => {
			const item = createMockItem({
				type: "agent",
				frontmatter: { tools: "Read, Write, Bash" },
			});
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.warnings.some((w) => w.includes("tools"))).toBe(true);
		});

		it("warns when agent has multiple unsupported fields", () => {
			const item = createMockItem({
				type: "agent",
				frontmatter: { model: "opus", tools: "all", memory: "full" },
			});
			const result = convertMdToKiroSteering(item, "kiro");

			const warning = result.warnings.find((w) => w.includes("not supported"));
			expect(warning).toContain("model");
			expect(warning).toContain("tools");
			expect(warning).toContain("memory");
		});

		it("does NOT warn for rules without agent fields", () => {
			const item = createMockItem({
				type: "rules",
				frontmatter: { name: "My Rule" },
			});
			const result = convertMdToKiroSteering(item, "kiro");

			const agentWarnings = result.warnings.filter((w) => w.includes("Agent metadata"));
			expect(agentWarnings).toHaveLength(0);
		});
	});

	describe("Claude reference stripping", () => {
		it("strips Claude-specific tool references", () => {
			const item = createMockItem({
				body: "Use the Read tool to read files. Check .claude/rules/ for more.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).not.toContain("Read tool");
			expect(result.content).toContain("file reading");
		});

		it("preserves code blocks during stripping", () => {
			const item = createMockItem({
				body: "Example:\n```\n.claude/rules/\n```\nDone.",
			});
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content).toContain("```");
		});
	});

	describe("output format", () => {
		it("returns correct filename", () => {
			const item = createMockItem({ name: "my-config" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.filename).toBe("my-config.md");
		});

		it("frontmatter comes before content", () => {
			const item = createMockItem();
			const result = convertMdToKiroSteering(item, "kiro");

			const frontmatterEnd = result.content.lastIndexOf("---");
			const contentStart = result.content.indexOf("# ");
			expect(frontmatterEnd).toBeLessThan(contentStart);
		});

		it("content ends with newline", () => {
			const item = createMockItem();
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.content.endsWith("\n")).toBe(true);
		});
	});

	describe("fileMatch warnings", () => {
		it("adds info warning when fileMatch mode is used", () => {
			const item = createMockItem({ name: "typescript-rules" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.warnings.some((w) => w.includes("Using fileMatch mode"))).toBe(true);
			expect(result.warnings.some((w) => w.includes("**/*.{ts,tsx}"))).toBe(true);
		});

		it("does not add fileMatch warning for always mode", () => {
			const item = createMockItem({ name: "general-rules" });
			const result = convertMdToKiroSteering(item, "kiro");

			expect(result.warnings.some((w) => w.includes("Using fileMatch mode"))).toBe(false);
		});
	});
});
