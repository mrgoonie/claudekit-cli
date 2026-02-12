/**
 * FM-to-JSON converter — convert agents to Cline custom modes JSON format
 * Also creates .clinerules/ plain MD files for rule-based access.
 */
import type { ConversionResult, PortableItem } from "../types.js";

/** Map Claude Code tool names to Cline group names */
const CLINE_GROUP_MAP: Record<string, string> = {
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
 * Convert tools string to Cline groups array
 */
function mapToolsToGroups(toolsStr: string): string[] {
	const tools = toolsStr.split(",").map((t) => t.trim());
	const groups = new Set<string>();
	for (const tool of tools) {
		const group = CLINE_GROUP_MAP[tool];
		if (group) groups.add(group);
	}
	if (groups.size > 0) groups.add("mcp");
	return Array.from(groups);
}

/**
 * Convert agent name to slug
 */
function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Cline custom mode object structure */
export interface ClineCustomMode {
	slug: string;
	name: string;
	roleDefinition: string;
	groups: string[];
	customInstructions: string;
}

/**
 * Convert a single agent to Cline custom mode object
 */
export function convertFmToJson(item: PortableItem): ConversionResult {
	const mode: ClineCustomMode = {
		slug: toSlug(item.name),
		name: item.frontmatter.name || item.name,
		roleDefinition: item.body,
		groups: item.frontmatter.tools
			? mapToolsToGroups(item.frontmatter.tools)
			: ["read", "edit", "command", "mcp"],
		customInstructions: "",
	};

	return {
		content: JSON.stringify(mode, null, 2),
		filename: `${toSlug(item.name)}.json`,
		warnings: [],
	};
}

/**
 * Build a complete cline_custom_modes.json from multiple mode objects
 */
export function buildClineModesJson(modes: ClineCustomMode[]): string {
	return JSON.stringify({ customModes: modes }, null, 2);
}

/**
 * Convert agent to plain MD for .clinerules/ directory
 */
export function convertToClineRule(item: PortableItem): ConversionResult {
	const content = `# ${item.frontmatter.name || item.name}\n\n${item.body}\n`;
	// For nested commands (docs/init), flatten to docs-init.md
	const filename = item.segments ? `${item.segments.join("-")}.md` : `${item.name}.md`;
	return {
		content,
		filename,
		warnings: [],
	};
}
