import { describe, expect, it } from "bun:test";
import {
	GEMINI_TOOL_NAME_MAP,
	mapEventName,
	requiresHookMapping,
	rewriteMatcherToolNames,
} from "../converters/gemini-hook-event-map.js";

describe("gemini-hook-event-map", () => {
	describe("mapEventName", () => {
		it("maps Claude Code PreToolUse to Gemini BeforeTool", () => {
			expect(mapEventName("PreToolUse")).toBe("BeforeTool");
		});

		it("maps PostToolUse to AfterTool", () => {
			expect(mapEventName("PostToolUse")).toBe("AfterTool");
		});

		it("maps SubagentStart to BeforeAgent", () => {
			expect(mapEventName("SubagentStart")).toBe("BeforeAgent");
		});

		it("maps SubagentStop to AfterAgent", () => {
			expect(mapEventName("SubagentStop")).toBe("AfterAgent");
		});

		it("maps Stop to SessionEnd", () => {
			expect(mapEventName("Stop")).toBe("SessionEnd");
		});

		it("maps Notification to Notification (passthrough)", () => {
			expect(mapEventName("Notification")).toBe("Notification");
		});

		it("maps PreCompact to PreCompress", () => {
			expect(mapEventName("PreCompact")).toBe("PreCompress");
		});

		it("returns original for unknown events", () => {
			expect(mapEventName("CustomEvent")).toBe("CustomEvent");
		});
	});

	describe("rewriteMatcherToolNames", () => {
		it("maps single tool name", () => {
			expect(rewriteMatcherToolNames("Edit")).toBe("replace");
		});

		it("maps pipe-separated tool names", () => {
			expect(rewriteMatcherToolNames("Edit|Write")).toBe("replace|write_file");
		});

		it("deduplicates mapped names (Edit and MultiEdit both map to replace)", () => {
			const result = rewriteMatcherToolNames("Edit|MultiEdit");
			expect(result).toBe("replace");
		});

		it("preserves unmapped entries (regex patterns, MCP tools)", () => {
			expect(rewriteMatcherToolNames("Edit|mcp_custom_tool")).toBe("replace|mcp_custom_tool");
		});

		it("returns empty string for empty matcher", () => {
			expect(rewriteMatcherToolNames("")).toBe("");
		});

		it("maps all known tool names", () => {
			const allTools = Object.keys(GEMINI_TOOL_NAME_MAP).join("|");
			const mapped = rewriteMatcherToolNames(allTools);
			// All mapped names should be Gemini CLI tool names
			for (const name of mapped.split("|")) {
				expect(Object.values(GEMINI_TOOL_NAME_MAP)).toContain(name);
			}
		});

		it("handles Bash correctly", () => {
			expect(rewriteMatcherToolNames("Bash")).toBe("run_shell_command");
		});

		it("handles Read correctly", () => {
			expect(rewriteMatcherToolNames("Read")).toBe("read_file");
		});

		it("maps Glob to glob (not list_directory)", () => {
			expect(rewriteMatcherToolNames("Glob")).toBe("glob");
		});

		it("maps Grep to grep_search", () => {
			expect(rewriteMatcherToolNames("Grep")).toBe("grep_search");
		});

		it("maps WebSearch to google_web_search", () => {
			expect(rewriteMatcherToolNames("WebSearch")).toBe("google_web_search");
		});
	});

	describe("requiresHookMapping", () => {
		it("returns true for gemini-cli", () => {
			expect(requiresHookMapping("gemini-cli")).toBe(true);
		});

		it("returns false for other providers", () => {
			expect(requiresHookMapping("claude-code")).toBe(false);
			expect(requiresHookMapping("codex")).toBe(false);
			expect(requiresHookMapping("droid")).toBe(false);
		});
	});
});
