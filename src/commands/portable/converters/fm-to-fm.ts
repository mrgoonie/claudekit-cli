/**
 * FM-to-FM converter — transform frontmatter fields for target provider
 * Used by: GitHub Copilot (.agent.md), Cursor (.mdc), Codex (agents)
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
 * Main FM-to-FM converter — dispatches to provider-specific logic
 */
export function convertFmToFm(item: PortableItem, provider: ProviderType): ConversionResult {
	switch (provider) {
		case "github-copilot":
			return convertForCopilot(item);
		case "cursor":
			return convertForCursor(item);
		default:
			// Fallback: strip frontmatter, return body only
			return {
				content: item.body,
				filename: `${item.name}.md`,
				warnings: [`No FM-to-FM converter for provider "${provider}", using body only`],
			};
	}
}
