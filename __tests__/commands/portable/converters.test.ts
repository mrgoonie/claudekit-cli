/**
 * Comprehensive tests for portable converters
 * Tests all conversion formats: direct-copy, fm-strip, fm-to-fm, fm-to-yaml, fm-to-json, md-to-toml, skill-md
 */
import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertDirectCopy } from "../../../src/commands/portable/converters/direct-copy.js";
import {
	buildMergedAgentsMd,
	convertFmStrip,
} from "../../../src/commands/portable/converters/fm-strip.js";
import { convertFmToFm } from "../../../src/commands/portable/converters/fm-to-fm.js";
import {
	type ClineCustomMode,
	buildClineModesJson,
	convertFmToJson,
} from "../../../src/commands/portable/converters/fm-to-json.js";
import {
	buildYamlModesFile,
	convertFmToYaml,
} from "../../../src/commands/portable/converters/fm-to-yaml.js";
import { convertItem } from "../../../src/commands/portable/converters/index.js";
import { convertMdToToml } from "../../../src/commands/portable/converters/md-to-toml.js";
import { convertToSkillMd } from "../../../src/commands/portable/converters/skill-md.js";
import type { PortableItem } from "../../../src/commands/portable/types.js";

/**
 * Test helper: create a PortableItem with defaults
 */
function makeItem(overrides: Partial<PortableItem> = {}): PortableItem {
	return {
		name: "test-agent",
		displayName: "Test Agent",
		description: "A test agent",
		type: "agent",
		sourcePath: "/fake/path/test-agent.md",
		frontmatter: {
			name: "Test Agent",
			description: "A test agent",
			tools: "Read,Write,Bash",
		},
		body: "You are a test agent.\n\nDo test things.",
		...overrides,
	};
}

describe("direct-copy converter", () => {
	it("returns content with frontmatter preserved via gray-matter", () => {
		const item = makeItem();
		const result = convertDirectCopy(item);

		expect(result.filename).toBe("test-agent.md");
		expect(result.warnings).toHaveLength(0);
		// Should contain frontmatter markers
		expect(result.content).toContain("---");
		expect(result.content).toContain("name: Test Agent");
		expect(result.content).toContain("description: A test agent");
		// Gray-matter wraps strings with commas in quotes
		expect(result.content).toContain("tools: 'Read,Write,Bash'");
		expect(result.content).toContain("Do test things.");
	});

	it("filename is {name}.md", () => {
		const item = makeItem({ name: "my-custom-agent" });
		const result = convertDirectCopy(item);

		expect(result.filename).toBe("my-custom-agent.md");
	});

	it("preserves nested namespace paths for commands", () => {
		const item = makeItem({
			name: "docs/init",
			segments: ["docs", "init"],
		});
		const result = convertDirectCopy(item);

		expect(result.filename).toBe("docs/init.md");
	});

	it("preserves raw source content when frontmatter is malformed", async () => {
		const dir = await mkdtemp(join(tmpdir(), "ck-direct-copy-"));
		const sourcePath = join(dir, "broken-command.md");
		const rawContent = [
			"---",
			"name: broken-command",
			"argument-hint: [command-name] [description]",
			"description: Plans directory (default: ./plans)",
			"---",
			"",
			"# Broken command",
		].join("\n");

		try {
			await writeFile(sourcePath, rawContent, "utf-8");

			const item = makeItem({
				name: "broken-command",
				sourcePath,
				frontmatter: {},
				body: "fallback body",
			});
			const result = convertDirectCopy(item);

			expect(result.content).toBe(rawContent);
			expect(result.filename).toBe("broken-command.md");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("fm-strip converter", () => {
	describe("merge provider (goose)", () => {
		it("content has ## Agent: {name} heading", () => {
			const item = makeItem({ frontmatter: { name: "Goose Agent" } });
			const result = convertFmStrip(item, "goose");

			expect(result.content).toContain("## Agent: Goose Agent");
			expect(result.content).toContain("Do test things.");
		});

		it("filename is AGENTS.md", () => {
			const item = makeItem();
			const result = convertFmStrip(item, "goose");

			expect(result.filename).toBe("AGENTS.md");
		});
	});

	describe("per-file provider (windsurf)", () => {
		it("content has # {name} heading", () => {
			const item = makeItem({ frontmatter: { name: "Windsurf Agent" } });
			const result = convertFmStrip(item, "windsurf");

			expect(result.content).toContain("# Windsurf Agent");
			expect(result.content).toContain("Do test things.");
		});

		it("filename is {name}.md", () => {
			const item = makeItem({ name: "windsurf-agent" });
			const result = convertFmStrip(item, "windsurf");

			expect(result.filename).toBe("windsurf-agent.md");
		});

		it("truncates content > 12000 chars with warning", () => {
			const longBody = "a".repeat(13000);
			const item = makeItem({
				frontmatter: { name: "Long Agent" },
				body: longBody,
			});
			const result = convertFmStrip(item, "windsurf");

			expect(result.content.length).toBeLessThan(13000);
			expect(result.content).toContain("[truncated");
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("truncated");
		});
	});

	describe("buildMergedAgentsMd", () => {
		it("builds header + sections separated by ---", () => {
			const sections = ["## Agent: First\n\nFirst body", "## Agent: Second\n\nSecond body"];
			const result = buildMergedAgentsMd(sections, "Goose");

			expect(result).toContain("# Agents");
			expect(result).toContain("Target: Goose");
			expect(result).toContain("## Agent: First");
			expect(result).toContain("---");
			expect(result).toContain("## Agent: Second");
		});
	});
});

describe("fm-to-fm converter", () => {
	describe("copilot", () => {
		it("produces {name}.agent.md with YAML frontmatter", () => {
			const item = makeItem({
				description: "A copilot agent",
				frontmatter: {
					name: "Copilot Agent",
					tools: "Read,Bash,WebFetch",
				},
			});
			const result = convertFmToFm(item, "github-copilot");

			expect(result.filename).toBe("test-agent.agent.md");
			expect(result.content).toContain("---");
			expect(result.content).toContain('name: "Copilot Agent"');
			expect(result.content).toContain('description: "A copilot agent"');
			expect(result.content).toContain("Do test things.");
		});

		it("maps tools correctly", () => {
			const item = makeItem({
				frontmatter: {
					tools: "Read,Bash,WebFetch,Glob",
				},
			});
			const result = convertFmToFm(item, "github-copilot");

			// Read→read, Bash→run_in_terminal, WebFetch→fetch, Glob→search
			expect(result.content).toContain("tools:");
			expect(result.content).toContain("- read");
			expect(result.content).toContain("- run_in_terminal");
			expect(result.content).toContain("- fetch");
			expect(result.content).toContain("- search");
		});

		it("shows 30K char warning", () => {
			const longBody = "a".repeat(31000);
			const item = makeItem({ body: longBody });
			const result = convertFmToFm(item, "github-copilot");

			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("30K");
		});
	});

	describe("cursor", () => {
		it("produces {name}.mdc with description and alwaysApply: false", () => {
			const item = makeItem({
				description: "Cursor agent description",
			});
			const result = convertFmToFm(item, "cursor");

			expect(result.filename).toBe("test-agent.mdc");
			expect(result.content).toContain("---");
			expect(result.content).toContain('description: "Cursor agent description"');
			expect(result.content).toContain("alwaysApply: false");
			expect(result.content).toContain("Do test things.");
		});
	});

	describe("unknown provider fallback", () => {
		it("returns body-only with warning", () => {
			const item = makeItem();
			const result = convertFmToFm(item, "unknown-provider" as any);

			expect(result.filename).toBe("test-agent.md");
			expect(result.content).toBe("You are a test agent.\n\nDo test things.");
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("No FM-to-FM converter");
		});
	});
});

describe("fm-to-yaml converter", () => {
	it("produces YAML with slug, name, roleDefinition", () => {
		const item = makeItem({
			name: "My Agent",
			frontmatter: { name: "My Agent", tools: "Read,Edit" },
		});
		const result = convertFmToYaml(item);

		expect(result.content).toContain('slug: "my-agent"');
		expect(result.content).toContain('name: "My Agent"');
		expect(result.content).toContain("roleDefinition: |");
		expect(result.content).toContain("You are a test agent.");
		expect(result.content).toContain("groups:");
	});

	it("maps tools to groups correctly", () => {
		const item = makeItem({
			frontmatter: { tools: "Read,Edit,Bash,WebFetch" },
		});
		const result = convertFmToYaml(item);

		// Read→read, Edit→edit, Bash→command, WebFetch→browser, auto-add mcp
		expect(result.content).toContain("- read");
		expect(result.content).toContain("- edit");
		expect(result.content).toContain("- command");
		expect(result.content).toContain("- browser");
		expect(result.content).toContain("- mcp");
	});

	it("escapes quotes in name properly", () => {
		const item = makeItem({
			frontmatter: { name: 'Agent "With Quotes"' },
		});
		const result = convertFmToYaml(item);

		expect(result.content).toContain('name: "Agent \\"With Quotes\\""');
	});

	it("buildYamlModesFile wraps entries with customModes header", () => {
		const entries = [
			'  - slug: "first"\n    name: "First"',
			'  - slug: "second"\n    name: "Second"',
		];
		const result = buildYamlModesFile(entries);

		expect(result).toContain("customModes:");
		expect(result).toContain('slug: "first"');
		expect(result).toContain('slug: "second"');
	});
});

describe("fm-to-json converter", () => {
	it("produces JSON with slug, name, roleDefinition, groups, customInstructions", () => {
		const item = makeItem({
			name: "json-agent",
			frontmatter: { name: "JSON Agent", tools: "Read,Edit" },
		});
		const result = convertFmToJson(item);

		const parsed = JSON.parse(result.content) as ClineCustomMode;
		expect(parsed.slug).toBe("json-agent");
		expect(parsed.name).toBe("JSON Agent");
		expect(parsed.roleDefinition).toContain("Do test things.");
		expect(parsed.groups).toContain("read");
		expect(parsed.groups).toContain("edit");
		expect(parsed.groups).toContain("mcp");
		expect(parsed.customInstructions).toBe("");
	});

	it("uses default groups when no tools specified", () => {
		const item = makeItem({
			frontmatter: { name: "No Tools" },
		});
		const result = convertFmToJson(item);

		const parsed = JSON.parse(result.content) as ClineCustomMode;
		expect(parsed.groups).toEqual(["read", "edit", "command", "mcp"]);
	});

	it("slug converts name to kebab-case", () => {
		const item = makeItem({
			name: "My Complex Agent Name",
		});
		const result = convertFmToJson(item);

		const parsed = JSON.parse(result.content) as ClineCustomMode;
		expect(parsed.slug).toBe("my-complex-agent-name");
	});

	it("buildClineModesJson wraps in { customModes: [...] }", () => {
		const modes: ClineCustomMode[] = [
			{
				slug: "first",
				name: "First",
				roleDefinition: "First role",
				groups: ["read"],
				customInstructions: "",
			},
			{
				slug: "second",
				name: "Second",
				roleDefinition: "Second role",
				groups: ["edit"],
				customInstructions: "",
			},
		];
		const result = buildClineModesJson(modes);

		const parsed = JSON.parse(result);
		expect(parsed.customModes).toHaveLength(2);
		expect(parsed.customModes[0].slug).toBe("first");
		expect(parsed.customModes[1].slug).toBe("second");
	});
});

describe("md-to-toml converter", () => {
	it("produces description and prompt with triple quotes", () => {
		const item = makeItem({
			description: "A test command",
			body: "Do something with {{args}}",
		});
		const result = convertMdToToml(item);

		expect(result.content).toContain('description = "A test command"');
		expect(result.content).toContain('prompt = """');
		expect(result.content).toContain("Do something with {{args}}");
		expect(result.content).toContain('"""');
	});

	it("maps $ARGUMENTS to {{args}}", () => {
		const item = makeItem({
			body: "Process $ARGUMENTS and return result",
		});
		const result = convertMdToToml(item);

		expect(result.content).toContain("Process {{args}} and return result");
		expect(result.content).not.toContain("$ARGUMENTS");
	});

	it("escapes triple quotes in content", () => {
		const item = makeItem({
			body: 'Use triple quotes: """\nSome content\n"""',
		});
		const result = convertMdToToml(item);

		// Should escape the inner triple quotes
		expect(result.content).toContain('\\"\\""');
	});

	it("adds newline to prevent trailing quote edge case", () => {
		const item = makeItem({
			body: 'Content ending with quote"',
		});
		const result = convertMdToToml(item);

		// Ensure trailing quote doesn't merge with closing """
		expect(result.content).toContain('"\n\n"""');
	});

	it("handles nested commands with segments", () => {
		const item = makeItem({
			name: "docs/init",
			segments: ["docs", "init"],
			body: "Initialize docs",
		});
		const result = convertMdToToml(item);

		expect(result.filename).toBe("docs/init.toml");
	});

	it("uses simple filename for non-nested commands", () => {
		const item = makeItem({
			name: "simple-command",
		});
		const result = convertMdToToml(item);

		expect(result.filename).toBe("simple-command.toml");
	});
});

describe("skill-md converter", () => {
	it("produces frontmatter with name and description", () => {
		const item = makeItem({
			description: "Skill description",
			frontmatter: { name: "Skill Name" },
		});
		const result = convertToSkillMd(item);

		expect(result.content).toContain("---");
		expect(result.content).toContain("name: Skill Name");
		expect(result.content).toContain("description: Skill description");
		expect(result.content).toContain("# Skill Name");
		expect(result.content).toContain("Do test things.");
	});

	it("filename is {name}/SKILL.md", () => {
		const item = makeItem({ name: "my-skill" });
		const result = convertToSkillMd(item);

		expect(result.filename).toBe("my-skill/SKILL.md");
	});
});

describe("convertItem dispatcher", () => {
	it("routes direct-copy format", () => {
		const item = makeItem();
		const result = convertItem(item, "direct-copy", "opencode");

		expect(result.filename).toBe("test-agent.md");
		expect(result.content).toContain("---");
	});

	it("routes fm-strip format", () => {
		const item = makeItem();
		const result = convertItem(item, "fm-strip", "windsurf");

		expect(result.filename).toBe("test-agent.md");
		expect(result.content).toContain("# Test Agent");
	});

	it("routes fm-to-fm format", () => {
		const item = makeItem();
		const result = convertItem(item, "fm-to-fm", "github-copilot");

		expect(result.filename).toBe("test-agent.agent.md");
		expect(result.content).toContain("---");
	});

	it("routes fm-to-yaml format", () => {
		const item = makeItem();
		const result = convertItem(item, "fm-to-yaml", "roo");

		expect(result.content).toContain('slug: "test-agent"');
		expect(result.content).toContain("roleDefinition: |");
	});

	it("routes fm-to-json format", () => {
		const item = makeItem();
		const result = convertItem(item, "fm-to-json", "cline");

		const parsed = JSON.parse(result.content);
		expect(parsed.slug).toBe("test-agent");
	});

	it("routes md-to-toml format", () => {
		const item = makeItem();
		const result = convertItem(item, "md-to-toml", "gemini-cli");

		expect(result.filename).toBe("test-agent.toml");
		expect(result.content).toContain('prompt = """');
	});

	it("routes skill-md format", () => {
		const item = makeItem();
		const result = convertItem(item, "skill-md", "openhands");

		expect(result.filename).toBe("test-agent/SKILL.md");
		expect(result.content).toContain("# Test Agent");
	});
});
