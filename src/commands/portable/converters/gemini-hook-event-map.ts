/**
 * Gemini CLI hook event and tool name mapping.
 * Maps Claude Code hook events/tool names to Gemini CLI equivalents.
 * Used by hooks-settings-merger when target provider is gemini-cli.
 *
 * Reference: Gemini CLI hooks (v0.26+)
 * - Events: BeforeTool, AfterTool, BeforeAgent, AfterAgent, SessionStart, SessionEnd,
 *           BeforeModel, AfterModel, Notification, PreCompress, BeforeToolSelection
 * - Tool names: read_file, read_many_files, write_file, replace,
 *               run_shell_command, grep_search, list_directory, glob,
 *               web_fetch, google_web_search, save_memory, ask_user
 */

import type { ProviderType } from "../types.js";

/** Claude Code hook event → Gemini CLI hook event */
const GEMINI_EVENT_MAP: Record<string, string> = {
	PreToolUse: "BeforeTool",
	PostToolUse: "AfterTool",
	SubagentStart: "BeforeAgent",
	SubagentStop: "AfterAgent",
	Stop: "SessionEnd",
	Notification: "Notification",
	PreCompact: "PreCompress",
};

/** Claude Code tool name → Gemini CLI tool name (for hook matchers) */
export const GEMINI_TOOL_NAME_MAP: Record<string, string> = {
	Read: "read_file",
	Glob: "glob",
	Grep: "grep_search",
	Edit: "replace",
	Write: "write_file",
	MultiEdit: "replace",
	Bash: "run_shell_command",
	WebFetch: "web_fetch",
	WebSearch: "google_web_search",
};

/** Map a single Claude Code event name to Gemini CLI equivalent. Returns original if no mapping. */
export function mapEventName(claudeEvent: string): string {
	return GEMINI_EVENT_MAP[claudeEvent] ?? claudeEvent;
}

/**
 * Rewrite tool names in a hook matcher string.
 * Matchers use pipe-separated tool names (e.g., "Edit|Write" → "replace|write_file").
 * Deduplicates mapped names (Edit and MultiEdit both map to "replace").
 */
export function rewriteMatcherToolNames(matcher: string): string {
	if (!matcher) return matcher;

	const parts = matcher.split("|").map((p) => p.trim());
	const mapped = new Set<string>();

	for (const part of parts) {
		// Try exact match first, then check if it's a regex pattern
		const directMap = GEMINI_TOOL_NAME_MAP[part];
		if (directMap) {
			mapped.add(directMap);
		} else {
			// Preserve non-mapped entries (could be regex patterns or MCP tools)
			mapped.add(part);
		}
	}

	return Array.from(mapped).join("|");
}

/** Check if a provider requires hook event/matcher mapping */
export function requiresHookMapping(provider: ProviderType): boolean {
	return provider === "gemini-cli";
}
