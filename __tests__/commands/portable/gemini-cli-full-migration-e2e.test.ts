/**
 * E2E integration test for full Gemini CLI migration.
 * Validates: tool call mapping in agents, hooks registration in settings.json,
 * rules/config in GEMINI.md with hook sections preserved.
 *
 * Fixture-based: creates temp directories simulating Claude Code project,
 * runs conversion pipeline, and verifies output matches Gemini CLI expectations.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildMergedAgentsMd,
	convertFmStrip,
} from "../../../src/commands/portable/converters/fm-strip.js";
import {
	mapEventName,
	rewriteMatcherToolNames,
} from "../../../src/commands/portable/converters/gemini-hook-event-map.js";
import { convertItem } from "../../../src/commands/portable/converters/index.js";
import {
	mapHookEventsForProvider,
	mergeHooksIntoSettings,
	rewriteHookPaths,
} from "../../../src/commands/portable/hooks-settings-merger.js";
import { providers } from "../../../src/commands/portable/provider-registry.js";
import type { PortableItem } from "../../../src/commands/portable/types.js";

const testDir = join(tmpdir(), "ck-gemini-e2e-test");

/** Helper to create a PortableItem */
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
			tools: "Read,Write,Bash,Grep,Edit",
		},
		body: "You are a test agent.",
		...overrides,
	};
}

beforeAll(() => {
	mkdirSync(testDir, { recursive: true });
});

afterAll(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("Gemini CLI full migration E2E", () => {
	// ── 1. Provider registry config validation ─────────────────
	describe("1. provider-registry config", () => {
		const gemini = providers["gemini-cli"];

		it("has all 7 portable types configured", () => {
			expect(gemini.agents).not.toBeNull();
			expect(gemini.commands).not.toBeNull();
			expect(gemini.skills).not.toBeNull();
			expect(gemini.config).not.toBeNull();
			expect(gemini.rules).not.toBeNull();
			expect(gemini.hooks).not.toBeNull();
			expect(gemini.settingsJsonPath).not.toBeNull();
		});

		it("hooks use direct-copy format to .gemini/hooks/", () => {
			expect(gemini.hooks?.projectPath).toBe(".gemini/hooks");
			expect(gemini.hooks?.format).toBe("direct-copy");
			expect(gemini.hooks?.writeStrategy).toBe("per-file");
		});

		it("settingsJsonPath points to .gemini/settings.json", () => {
			expect(gemini.settingsJsonPath?.projectPath).toBe(".gemini/settings.json");
		});
	});

	// ── 2. Agent tool call mapping (fm-strip + body rewriting) ──
	describe("2. agent tool call mapping", () => {
		it("rewrites all Claude tool names in agent body", () => {
			const item = makeItem({
				body: [
					"Use the Read tool to read files.",
					"Use the Write tool to create files.",
					"Use the Edit tool to modify files.",
					"Use Bash for shell commands.",
					"Use Grep for searching code.",
					"Use Glob for file patterns.",
					"Use WebFetch for HTTP requests.",
					"Use WebSearch for web queries.",
				].join("\n"),
			});

			const result = convertFmStrip(item, "gemini-cli");

			// Should NOT contain Claude tool names
			expect(result.content).not.toContain("Read tool");
			expect(result.content).not.toContain("Write tool");
			expect(result.content).not.toContain("Edit tool");
			expect(result.content).not.toContain("Use Bash");
			expect(result.content).not.toContain("Use Grep");
			expect(result.content).not.toContain("Use Glob");
			expect(result.content).not.toContain("WebFetch");
			expect(result.content).not.toContain("WebSearch");

			// Should contain generic replacements
			expect(result.content).toContain("file reading");
			expect(result.content).toContain("file writing");
			expect(result.content).toContain("file editing");
			expect(result.content).toContain("terminal/shell");
			expect(result.content).toContain("code search");
			expect(result.content).toContain("file search");
			expect(result.content).toContain("web access");
		});

		it("rewrites .claude/ paths to Gemini equivalents", () => {
			const item = makeItem({
				body: "Read .claude/rules/my-rule.md and check CLAUDE.md for config.",
			});
			const result = convertFmStrip(item, "gemini-cli");

			expect(result.content).toContain("GEMINI.md");
			expect(result.content).not.toContain("CLAUDE.md");
			expect(result.content).not.toContain(".claude/rules/");
		});

		it("removes slash command references", () => {
			const item = makeItem({
				body: "Run /cook to implement. Then /test for validation.",
			});
			const result = convertFmStrip(item, "gemini-cli");

			expect(result.content).not.toContain("/cook");
			expect(result.content).not.toContain("/test");
		});

		it("preserves delegation patterns (subagents: planned)", () => {
			const item = makeItem({
				body: "Delegate to `planner` agent for research.",
			});
			const result = convertFmStrip(item, "gemini-cli");

			// Gemini CLI has subagents: "planned", so delegation should be preserved
			expect(result.content).toContain("Delegate to `planner` agent");
		});

		it("produces valid merge-single output (AGENTS.md)", () => {
			const agents = [
				makeItem({ name: "scout", frontmatter: { name: "Scout" }, body: "Explore the codebase." }),
				makeItem({
					name: "planner",
					frontmatter: { name: "Planner" },
					body: "Create implementation plans.",
				}),
			];

			const sections = agents.map((a) => convertFmStrip(a, "gemini-cli").content);
			const merged = buildMergedAgentsMd(sections, "Gemini CLI");

			expect(merged).toContain("# Agents");
			expect(merged).toContain("Target: Gemini CLI");
			expect(merged).toContain("## Agent: Scout");
			expect(merged).toContain("## Agent: Planner");
			expect(merged).toContain("---");
		});
	});

	// ── 3. Hooks migration (event mapping + settings.json merge) ──
	describe("3. hooks migration", () => {
		it("maps all Claude Code event names to Gemini equivalents", () => {
			expect(mapEventName("PreToolUse")).toBe("BeforeTool");
			expect(mapEventName("PostToolUse")).toBe("AfterTool");
			expect(mapEventName("SubagentStart")).toBe("BeforeAgent");
			expect(mapEventName("SubagentStop")).toBe("AfterAgent");
			expect(mapEventName("Stop")).toBe("SessionEnd");
			expect(mapEventName("Notification")).toBe("Notification");
			expect(mapEventName("PreCompact")).toBe("PreCompress");
		});

		it("maps tool names in matchers", () => {
			expect(rewriteMatcherToolNames("Edit|Write|Bash")).toBe(
				"replace|write_file|run_shell_command",
			);
			expect(rewriteMatcherToolNames("Read")).toBe("read_file");
		});

		it("full pipeline: source hooks → path-rewritten → event-mapped → merged into settings.json", async () => {
			// Simulate Claude Code hooks section with .claude/hooks/ source paths
			const sourceHooks = {
				PreToolUse: [
					{
						matcher: "Edit|Write",
						hooks: [
							{
								type: "command",
								command: 'node ".claude/hooks/block-secrets.cjs"',
								timeout: 5000,
							},
						],
					},
				],
				PostToolUse: [
					{
						hooks: [
							{
								type: "command",
								command: 'node ".claude/hooks/log-changes.cjs"',
							},
						],
					},
				],
				SubagentStart: [
					{
						hooks: [
							{
								type: "command",
								command: 'node ".claude/hooks/agent-init.cjs"',
							},
						],
					},
				],
			};

			// Step 1: Rewrite paths from .claude/hooks/ to .gemini/hooks/
			const rewritten = rewriteHookPaths(sourceHooks, ".claude/hooks", ".gemini/hooks");
			expect(rewritten.PreToolUse[0].hooks[0].command).toContain(".gemini/hooks/");
			expect(rewritten.PostToolUse[0].hooks[0].command).toContain(".gemini/hooks/");

			// Step 2: Map events and matchers
			const mapped = mapHookEventsForProvider(rewritten, "gemini-cli");

			// Verify event mapping
			expect(mapped.BeforeTool).toBeDefined();
			expect(mapped.AfterTool).toBeDefined();
			expect(mapped.BeforeAgent).toBeDefined();
			expect(mapped.PreToolUse).toBeUndefined();
			expect(mapped.PostToolUse).toBeUndefined();
			expect(mapped.SubagentStart).toBeUndefined();

			// Verify matcher tool name mapping
			expect(mapped.BeforeTool?.[0].matcher).toBe("replace|write_file");

			// Verify paths were rewritten before event mapping
			expect(mapped.BeforeTool?.[0].hooks[0].command).toContain(".gemini/hooks/");

			// Step 3: Merge into target settings.json
			const targetSettingsPath = join(testDir, "e2e-settings.json");
			writeFileSync(targetSettingsPath, JSON.stringify({ theme: "dark" }));

			await mergeHooksIntoSettings(targetSettingsPath, mapped);

			// Step 4: Verify final settings.json
			const result = JSON.parse(readFileSync(targetSettingsPath, "utf8"));
			expect(result.theme).toBe("dark"); // Preserved existing config
			expect(result.hooks).toBeDefined();
			expect(result.hooks.BeforeTool).toHaveLength(1);
			expect(result.hooks.BeforeTool[0].matcher).toBe("replace|write_file");
			expect(result.hooks.BeforeTool[0].hooks[0].timeout).toBe(5000);
			expect(result.hooks.BeforeTool[0].hooks[0].command).toContain(".gemini/hooks/");
			expect(result.hooks.AfterTool).toHaveLength(1);
			expect(result.hooks.BeforeAgent).toHaveLength(1);
		});

		it("creates settings.json if it does not exist", async () => {
			const newSettingsPath = join(testDir, "e2e-new-settings.json");
			const hooks = {
				BeforeTool: [
					{
						matcher: "write_file",
						hooks: [{ type: "command", command: "echo check" }],
					},
				],
			};

			await mergeHooksIntoSettings(newSettingsPath, hooks);

			expect(existsSync(newSettingsPath)).toBe(true);
			const result = JSON.parse(readFileSync(newSettingsPath, "utf8"));
			expect(result.hooks.BeforeTool).toHaveLength(1);
		});
	});

	// ── 4. Rules / config migration ──────────────────────────────
	describe("4. rules and config migration", () => {
		it("preserves hook-related sections in rules (hooks now enabled)", () => {
			const item = makeItem({
				type: "rules",
				body: [
					"## Project Rules",
					"Follow coding standards.",
					"",
					"## Hook Configuration",
					"Configure hooks for pre-commit checks.",
					"Use PreToolUse hooks for security scanning.",
					"",
					"## Testing",
					"Write tests for everything.",
				].join("\n"),
			});

			const result = convertItem(item, "md-strip", "gemini-cli");

			// Hook section should be PRESERVED (not stripped) since Gemini CLI now has hooks
			expect(result.content).toContain("Hook Configuration");
			expect(result.content).toContain("Testing");
			expect(result.content).toContain("Project Rules");
		});

		it("rewrites tool names in rules content", () => {
			const item = makeItem({
				type: "rules",
				body: "Use the Read tool for file access. Check CLAUDE.md.",
			});

			const result = convertItem(item, "md-strip", "gemini-cli");

			expect(result.content).toContain("file reading");
			expect(result.content).toContain("GEMINI.md");
		});

		it("preserves delegation patterns in rules", () => {
			const item = makeItem({
				type: "rules",
				body: "Delegate to `tester` agent after implementation.",
			});

			const result = convertItem(item, "md-strip", "gemini-cli");

			// subagents: "planned" means delegation is preserved
			expect(result.content).toContain("Delegate to `tester` agent");
		});
	});

	// ── 5. Commands migration (md-to-toml, unchanged) ────────────
	describe("5. commands migration (regression check)", () => {
		it("converts commands to TOML format", () => {
			const item = makeItem({
				type: "command",
				name: "deploy",
				description: "Deploy the app",
				frontmatter: { description: "Deploy the app" },
				body: "Deploy the application to production.\n\n$ARGUMENTS",
			});

			const result = convertItem(item, "md-to-toml", "gemini-cli");

			expect(result.filename).toBe("deploy.toml");
			expect(result.content).toContain("Deploy the app");
			expect(result.content).toContain("{{args}}"); // $ARGUMENTS → {{args}}
		});
	});

	// ── 6. Cross-cutting: full migration simulation ──────────────
	describe("6. full migration simulation", () => {
		it("simulates complete migration: agents + hooks + rules + commands", () => {
			// Agent
			const agentItem = makeItem({
				name: "code-reviewer",
				frontmatter: { name: "Code Reviewer", tools: "Read,Edit,Bash,Grep" },
				body: "Use the Read tool to review code. Use Bash for running tests. Check .claude/rules/ for standards.",
			});
			const agentResult = convertFmStrip(agentItem, "gemini-cli");

			// Rules
			const rulesItem = makeItem({
				type: "rules",
				name: "dev-rules",
				body: "Follow CLAUDE.md instructions. Use the Edit tool for changes.\n\n## Hooks\nConfigure pre-commit hooks.",
			});
			const rulesResult = convertItem(rulesItem, "md-strip", "gemini-cli");

			// Command
			const cmdItem = makeItem({
				type: "command",
				name: "review",
				frontmatter: { description: "Code review" },
				body: "Review the following code:\n\n$ARGUMENTS",
			});
			const cmdResult = convertItem(cmdItem, "md-to-toml", "gemini-cli");

			// Hooks
			const hooks = mapHookEventsForProvider(
				{
					PreToolUse: [
						{
							matcher: "Edit|Write",
							hooks: [{ type: "command", command: "node .gemini/hooks/lint.cjs" }],
						},
					],
				},
				"gemini-cli",
			);

			// All assertions
			expect(agentResult.content).toContain("## Agent: Code Reviewer");
			expect(agentResult.content).toContain("file reading");
			expect(agentResult.content).not.toContain("Read tool");

			expect(rulesResult.content).toContain("GEMINI.md");
			expect(rulesResult.content).toContain("Hooks"); // Preserved
			expect(rulesResult.content).not.toContain("CLAUDE.md");

			expect(cmdResult.filename).toBe("review.toml");
			expect(cmdResult.content).toContain("{{args}}");

			expect(hooks.BeforeTool?.[0].matcher).toBe("replace|write_file");
		});
	});
});
