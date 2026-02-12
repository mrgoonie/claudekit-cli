/**
 * FM-to-YAML converter — convert agents to Roo Code / Kilo Code YAML mode format
 * Both use identical schema: customModes array with slug, name, roleDefinition, groups
 */
import type { ConversionResult, PortableItem } from "../types.js";

/** Map Claude Code tool names to Roo/Kilo group names */
const TOOL_GROUP_MAP: Record<string, string> = {
	Read: "read",
	Glob: "read",
	Grep: "read",
	Edit: "edit",
	Write: "edit",
	MultiEdit: "edit",
	Bash: "command",
	WebFetch: "browser",
	WebSearch: "browser",
};

/**
 * Convert a Claude Code tools string to Roo/Kilo group names
 */
function mapToolsToGroups(toolsStr: string): string[] {
	const tools = toolsStr.split(",").map((t) => t.trim());
	const groups = new Set<string>();
	for (const tool of tools) {
		const group = TOOL_GROUP_MAP[tool];
		if (group) groups.add(group);
	}
	// MCP tools are always enabled if any tool is present
	if (groups.size > 0) groups.add("mcp");
	return Array.from(groups);
}

/**
 * Convert agent name to kebab-case slug
 */
function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Escape YAML string value — escape inner double quotes
 */
function yamlEscape(str: string): string {
	return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Convert a single agent to YAML mode entry
 * Returns the YAML string for one mode object (not the full file)
 */
export function convertFmToYaml(item: PortableItem): ConversionResult {
	const slug = toSlug(item.name);
	const displayName = item.frontmatter.name || item.name;
	const description = item.description || "";
	const groups = item.frontmatter.tools
		? mapToolsToGroups(item.frontmatter.tools)
		: ["read", "edit", "command", "browser", "mcp"];

	// Build YAML for one mode entry
	const lines: string[] = [];
	lines.push(`  - slug: "${slug}"`);
	lines.push(`    name: "${yamlEscape(displayName)}"`);
	if (description) {
		lines.push(`    description: "${yamlEscape(description.slice(0, 200))}"`);
	}
	lines.push("    roleDefinition: |");
	for (const line of item.body.split("\n")) {
		lines.push(`      ${line}`);
	}
	lines.push('    customInstructions: ""');
	lines.push("    groups:");
	for (const group of groups) {
		lines.push(`      - ${group}`);
	}

	return {
		content: lines.join("\n"),
		filename: slug, // Used as identifier for merging
		warnings: [],
	};
}

/**
 * Build a complete Roo/Kilo YAML modes file from multiple converted items
 */
export function buildYamlModesFile(convertedEntries: string[]): string {
	const lines = ["customModes:"];
	for (const entry of convertedEntries) {
		lines.push(entry);
	}
	return `${lines.join("\n")}\n`;
}
