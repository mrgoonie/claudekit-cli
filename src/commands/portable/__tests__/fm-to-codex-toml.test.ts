/**
 * Tests for Codex TOML multi-agent converter and config entry builder
 */
import { describe, expect, it } from "bun:test";
import { mergeConfigToml, mergeConfigTomlWithDiagnostics } from "../codex-toml-installer.js";
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

	it("falls back to a hashed slug when no ascii chars remain", () => {
		expect(toCodexSlug("🔥🔥")).toMatch(/^agent_[0-9a-f]{8}$/);
	});

	it("caps slug length to avoid path length blowups", () => {
		expect(toCodexSlug("a".repeat(300)).length).toBeLessThanOrEqual(96);
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

	it("escapes model hint safely when model contains quotes/newlines", () => {
		const result = convertFmToCodexToml(
			makeItem({
				frontmatter: {
					model: 'o"pus\n[agents.injected]',
				},
			}),
		);
		expect(result.content).toContain('# model = "o\\"pus\\n[agents.injected]"');
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
		expect(result.content).toContain('sandbox_mode = "read-only"');
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

	it("supports semicolon-delimited tool lists", () => {
		const result = convertFmToCodexToml(
			makeItem({
				frontmatter: {
					tools: "Read;Edit;Bash",
				},
			}),
		);
		expect(result.content).toContain('sandbox_mode = "workspace-write"');
	});

	it("warns and continues when tools frontmatter is non-string", () => {
		const result = convertFmToCodexToml(
			makeItem({
				frontmatter: {
					tools: ["Read", "Edit"] as unknown as string,
				},
			}),
		);
		expect(result.content).not.toContain("sandbox_mode");
		expect(result.warnings.some((warning) => warning.includes("Ignored non-string tools"))).toBe(
			true,
		);
	});

	it("always writes developer_instructions and warns when body is empty", () => {
		const result = convertFmToCodexToml(makeItem({ body: "   " }));
		expect(result.content).toContain('developer_instructions = """');
		expect(result.warnings.some((warning) => warning.includes("empty body"))).toBe(true);
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

	it("collapses multiple managed blocks into one", () => {
		const existing = [
			"# --- ck-managed-agents-start ---",
			"[agents.one]",
			'description = "one"',
			'config_file = "agents/one.toml"',
			"# --- ck-managed-agents-end ---",
			"",
			"# --- ck-managed-agents-start ---",
			"[agents.two]",
			'description = "two"',
			'config_file = "agents/two.toml"',
			"# --- ck-managed-agents-end ---",
		].join("\n");
		const result = mergeConfigToml(existing, block);
		expect((result.match(/# --- ck-managed-agents-start ---/g) ?? []).length).toBe(1);
		expect(result).toContain("[agents.test]");
		expect(result).not.toContain("[agents.one]");
		expect(result).not.toContain("[agents.two]");
	});

	it("preserves CRLF line endings", () => {
		const existing = 'model = "gpt-5.3-codex"\r\n\r\n[features]\r\nmulti_agent = true\r\n';
		const result = mergeConfigToml(existing, block);
		expect(result).toContain("\r\n# --- ck-managed-agents-start ---\r\n");
		expect(result.includes("\n# --- ck-managed-agents-start ---\n")).toBe(false);
	});

	it("returns diagnostic error for malformed unmatched sentinels", () => {
		const existing =
			'# --- ck-managed-agents-start ---\n[agents.old]\ndescription = "Old"\nconfig_file = "agents/old.toml"\n';
		const result = mergeConfigTomlWithDiagnostics(existing, block);
		expect(result.error).toContain("Malformed CK managed agent sentinels");
	});
});
