/**
 * FM-to-FM converter — transform frontmatter fields for target provider
 * Used by: GitHub Copilot (.agent.md), Cursor (.mdc), OpenCode (.md)
 */
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

/** Copilot built-in tool names mapped from Claude Code tool names */
const COPILOT_TOOL_MAP: Record<string, string> = {
	Read: "read",
	Glob: "search",
	Grep: "search",
	Edit: "edit",
	Write: "edit",
	MultiEdit: "edit",
	Bash: "run_in_terminal",
	WebFetch: "fetch",
	WebSearch: "fetch",
};

/**
 * Convert for GitHub Copilot .agent.md format
 * FM fields: name, description, model, tools (array of built-in names)
 */
function convertForCopilot(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const fm: Record<string, unknown> = {};

	fm.name = item.frontmatter.name || item.name;
	if (item.description) fm.description = item.description;
	if (item.frontmatter.model) fm.model = item.frontmatter.model;

	// Map Claude Code tools to Copilot built-in tool names
	if (item.frontmatter.tools) {
		const sourceTools = item.frontmatter.tools.split(",").map((t) => t.trim());
		const mappedTools = new Set<string>();
		for (const tool of sourceTools) {
			const mapped = COPILOT_TOOL_MAP[tool];
			if (mapped) {
				mappedTools.add(mapped);
			}
		}
		if (mappedTools.size > 0) {
			fm.tools = Array.from(mappedTools);
		}
	}

	// Build content
	const fmLines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		if (Array.isArray(value)) {
			fmLines.push(`${key}:`);
			for (const v of value) {
				fmLines.push(`  - ${v}`);
			}
		} else {
			fmLines.push(`${key}: ${JSON.stringify(value)}`);
		}
	}
	fmLines.push("---");

	const content = `${fmLines.join("\n")}\n\n${item.body}\n`;

	// Check 30K char limit
	if (content.length > 30000) {
		warnings.push(`Content exceeds Copilot 30K char limit (${content.length} chars)`);
	}

	return {
		content,
		filename: `${item.name}.agent.md`,
		warnings,
	};
}

/**
 * Convert for Cursor .mdc format
 * FM fields: description, globs, alwaysApply (only 3 fields supported)
 */
function convertForCursor(item: PortableItem): ConversionResult {
	const fm: Record<string, unknown> = {};

	if (item.description) fm.description = item.description;
	fm.alwaysApply = false;
	// No globs by default — agents don't map to file patterns

	const fmLines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		fmLines.push(`${key}: ${JSON.stringify(value)}`);
	}
	fmLines.push("---");

	const content = `${fmLines.join("\n")}\n\n${item.body}\n`;

	return {
		content,
		filename: `${item.name}.mdc`,
		warnings: [],
	};
}

/**
 * OpenCode tool names mapped from Claude Code tool names.
 * OpenCode tools use boolean flags — we map Claude tool names to the
 * corresponding OpenCode tool key. Unmapped tools are silently skipped
 * (OpenCode defaults all tools to true when the field is omitted).
 */
const OPENCODE_TOOL_MAP: Record<string, string> = {
	Read: "read",
	Glob: "glob",
	Grep: "grep",
	Edit: "edit",
	Write: "write",
	MultiEdit: "edit",
	Bash: "bash",
	WebFetch: "webfetch",
	WebSearch: "webfetch",
	NotebookEdit: "write",
};

/** Replace .claude/ paths with .opencode/ in content */
function replaceClaudePathsForOpenCode(content: string): string {
	return content.replace(/\.claude\//g, ".opencode/");
}

/**
 * Convert for OpenCode .md agent format
 * FM fields: description, mode, tools (object with boolean flags)
 * Ref: https://opencode.ai/docs/agents/
 */
function convertOpenCodeAgent(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const agentName = item.frontmatter.name || item.name;

	// Determine mode: brainstormer is primary, everything else is subagent
	const mode = agentName === "brainstormer" ? "primary" : "subagent";

	// Map Claude tools string to OpenCode boolean tool flags
	let toolsObj: Record<string, boolean> | null = null;
	if (item.frontmatter.tools) {
		const sourceTools = item.frontmatter.tools.split(",").map((t) => t.trim());
		const mapped = new Set<string>();
		for (const tool of sourceTools) {
			const key = OPENCODE_TOOL_MAP[tool];
			if (key) mapped.add(key);
		}
		if (mapped.size > 0) {
			toolsObj = {};
			for (const key of mapped) {
				toolsObj[key] = true;
			}
		}
	}

	// Build YAML frontmatter
	const fmLines = ["---"];

	// Description (truncate for clean YAML)
	const desc = (item.description || `Agent: ${agentName}`).replace(/\n/g, " ").trim();
	const truncatedDesc = desc.length > 200 ? `${desc.slice(0, 197)}...` : desc;
	fmLines.push(`description: ${JSON.stringify(truncatedDesc)}`);

	fmLines.push(`mode: ${mode}`);

	// Tools as nested object with boolean flags
	if (toolsObj) {
		fmLines.push("tools:");
		for (const [key, val] of Object.entries(toolsObj)) {
			fmLines.push(`  ${key}: ${val}`);
		}
	}

	fmLines.push("---");

	const body = replaceClaudePathsForOpenCode(item.body);
	const content = `${fmLines.join("\n")}\n\n${body}\n`;

	return {
		content,
		filename: `${item.name}.md`,
		warnings,
	};
}

/**
 * Convert for OpenCode .md command format
 * FM fields: description, agent (optional)
 * Strips Claude-specific fields (argument-hint) and replaces .claude/ paths.
 * Ref: https://opencode.ai/docs/commands/
 */
function convertOpenCodeCommand(item: PortableItem): ConversionResult {
	const fmLines = ["---"];

	const desc = (item.description || `Command: ${item.name}`).replace(/\n/g, " ").trim();
	const truncatedDesc = desc.length > 200 ? `${desc.slice(0, 197)}...` : desc;
	fmLines.push(`description: ${JSON.stringify(truncatedDesc)}`);

	// Carry over agent field if present (OpenCode supports it)
	if (item.frontmatter.agent) {
		fmLines.push(`agent: ${JSON.stringify(item.frontmatter.agent)}`);
	}

	fmLines.push("---");

	const body = replaceClaudePathsForOpenCode(item.body);
	const content = `${fmLines.join("\n")}\n\n${body}\n`;

	return {
		content,
		filename: `${item.name}.md`,
		warnings: [],
	};
}

/**
 * Main FM-to-FM converter — dispatches to provider-specific logic
 */
export function convertFmToFm(item: PortableItem, provider: ProviderType): ConversionResult {
	switch (provider) {
		case "github-copilot":
			return convertForCopilot(item);
		case "cursor":
			return convertForCursor(item);
		case "opencode":
			// Route agents vs commands based on item type
			if (item.type === "command") return convertOpenCodeCommand(item);
			return convertOpenCodeAgent(item);
		default:
			// Fallback: strip frontmatter, return body only
			return {
				content: item.body,
				filename: `${item.name}.md`,
				warnings: [`No FM-to-FM converter for provider "${provider}", using body only`],
			};
	}
}
