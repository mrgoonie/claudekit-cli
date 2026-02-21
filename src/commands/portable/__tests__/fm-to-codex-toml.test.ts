/**
 * Tests for Codex TOML multi-agent converter and config entry builder
 */
import { describe, expect, it } from "bun:test";
import { mergeConfigToml } from "../codex-toml-installer.js";
import {
	buildCodexConfigEntry,
	convertFmToCodexToml,
	toCodexSlug,
} from "../converters/fm-to-codex-toml.js";
import type { PortableItem } from "../types.js";

function makeItem(overrides: Partial<PortableItem> = {}): PortableItem {
	return {
		name: "code-reviewer",
		displayName: "Code Reviewer",
		description: "Reviews code quality",
		type: "agent",
		sourcePath: "/fake/agents/code-reviewer.md",
		frontmatter: {
			name: "Code Reviewer",
			description: "Reviews code quality and security",
			model: "opus",
			tools: "Read, Grep, Glob, Task(Explore)",
		},
		body: "You are a senior code reviewer.\n\nReview all changes for quality.",
		...overrides,
	};
}

describe("toCodexSlug", () => {
	it("converts kebab-case to snake_case", () => {
		expect(toCodexSlug("code-reviewer")).toBe("code_reviewer");
	});

	it("converts mixed separators", () => {
		expect(toCodexSlug("my--agent-name")).toBe("my_agent_name");
	});

	it("strips leading/trailing separators", () => {
		expect(toCodexSlug("-agent-")).toBe("agent");
	});

	it("lowercases", () => {
		expect(toCodexSlug("MyAgent")).toBe("myagent");
	});

	it("handles dots and special chars", () => {
		expect(toCodexSlug("agent.v2!")).toBe("agent_v2");
	});
});

describe("convertFmToCodexToml", () => {
	it("generates per-agent TOML with developer_instructions", () => {
		const result = convertFmToCodexToml(makeItem());
		expect(result.filename).toBe("code_reviewer.toml");
		expect(result.content).toContain('developer_instructions = """');
		expect(result.content).toContain("You are a senior code reviewer.");
		expect(result.warnings).toEqual([]);
	});

	it("includes commented model hint", () => {
		const result = convertFmToCodexToml(makeItem());
		expect(result.content).toContain('# model = "opus"');
	});

	it("omits model hint when not set", () => {
		const result = convertFmToCodexToml(makeItem({ frontmatter: { name: "Test" } }));
		expect(result.content).not.toContain("# model");
	});

	it("derives workspace-read for read-only tools", () => {
		const result = convertFmToCodexToml(
			makeItem({
				frontmatter: {
					name: "Explorer",
					tools: "Read, Grep, Glob",
				},
			}),
		);
		expect(result.content).toContain('sandbox_mode = "workspace-read"');
	});

	it("derives workspace-write for write tools", () => {
		const result = convertFmToCodexToml(
			makeItem({
				frontmatter: {
					name: "Developer",
					tools: "Read, Write, Edit, Bash",
				},
			}),
		);
		expect(result.content).toContain('sandbox_mode = "workspace-write"');
	});

	it("omits sandbox_mode when no tools defined", () => {
		const result = convertFmToCodexToml(makeItem({ frontmatter: { name: "Generic" } }));
		expect(result.content).not.toContain("sandbox_mode");
	});

	it("escapes triple quotes in body", () => {
		const result = convertFmToCodexToml(makeItem({ body: 'Use """triple quotes""" carefully' }));
		expect(result.content).not.toMatch(/"""\s*triple/);
	});
});

describe("buildCodexConfigEntry", () => {
	it("generates correct TOML table entry", () => {
		const entry = buildCodexConfigEntry("code-reviewer", "Reviews code");
		expect(entry).toContain("[agents.code_reviewer]");
		expect(entry).toContain('description = "Reviews code"');
		expect(entry).toContain('config_file = "agents/code_reviewer.toml"');
	});

	it("uses name as fallback description", () => {
		const entry = buildCodexConfigEntry("debugger");
		expect(entry).toContain('description = "debugger"');
	});
});

describe("mergeConfigToml", () => {
	const block = '[agents.test]\ndescription = "Test"';

	it("appends sentinel block to empty config", () => {
		const result = mergeConfigToml("", block);
		expect(result).toContain("# --- ck-managed-agents-start ---");
		expect(result).toContain("# --- ck-managed-agents-end ---");
		expect(result).toContain("[agents.test]");
	});

	it("appends after existing settings", () => {
		const existing = 'model = "gpt-5.3-codex"\n\n[features]\nmulti_agent = true';
		const result = mergeConfigToml(existing, block);
		expect(result).toContain('model = "gpt-5.3-codex"');
		expect(result).toContain("[features]");
		expect(result).toContain("[agents.test]");
	});

	it("replaces existing sentinel block", () => {
		const existing = `model = "gpt-5.3-codex"\n\n# --- ck-managed-agents-start ---\n[agents.old]\ndescription = "Old"\n# --- ck-managed-agents-end ---\n`;
		const result = mergeConfigToml(existing, block);
		expect(result).not.toContain("[agents.old]");
		expect(result).toContain("[agents.test]");
		expect(result).toContain('model = "gpt-5.3-codex"');
	});
});
