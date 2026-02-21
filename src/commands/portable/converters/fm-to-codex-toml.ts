/**
 * FM-to-Codex-TOML converter — convert Claude Code agents to Codex TOML multi-agent format
 * Used by: Codex (.codex/agents/*.toml + config.toml registry entries)
 *
 * Generates per-agent TOML with developer_instructions, sandbox_mode, model hints.
 * Separate helper builds [agents.X] registry entries for config.toml.
 */
import type { ConversionResult, PortableItem } from "../types.js";
import { escapeTomlMultiline } from "./md-to-toml.js";

/** Convert kebab-case agent name to snake_case TOML table key */
export function toCodexSlug(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_|_$/g, "")
		.toLowerCase();
}

/** Derive Codex sandbox_mode from Claude Code tools string */
function deriveSandboxMode(tools?: string): string | null {
	if (!tools) return null;
	const toolList = tools
		.split(/[,|]/)
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean);

	const hasWrite = toolList.some((t) =>
		["bash", "write", "edit", "multiedit", "notebookedit"].includes(t),
	);
	const hasRead = toolList.some((t) => ["read", "grep", "glob", "ls"].includes(t));

	if (hasWrite) return "workspace-write";
	if (hasRead) return "workspace-read";
	return null;
}

/** Convert a Claude Code agent to Codex per-agent TOML content */
export function convertFmToCodexToml(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const slug = toCodexSlug(item.name);
	const lines: string[] = [];

	// Model hint (commented — user should configure their own model)
	if (item.frontmatter.model) {
		lines.push(`# model = "${item.frontmatter.model}"`);
	}

	// Sandbox mode derived from tools
	const sandbox = deriveSandboxMode(item.frontmatter.tools);
	if (sandbox) {
		lines.push(`sandbox_mode = "${sandbox}"`);
	}

	// Developer instructions (the agent's core prompt)
	const body = item.body.trim();
	if (body) {
		lines.push(`\ndeveloper_instructions = """\n${escapeTomlMultiline(body)}\n"""`);
	}

	return {
		content: lines.join("\n"),
		filename: `${slug}.toml`,
		warnings,
	};
}

/** Build a config.toml [agents.X] registry entry for an agent */
export function buildCodexConfigEntry(name: string, description?: string): string {
	const slug = toCodexSlug(name);
	const desc = description || name;
	const lines = [
		`[agents.${slug}]`,
		`description = ${JSON.stringify(desc)}`,
		`config_file = "agents/${slug}.toml"`,
	];
	return lines.join("\n");
}
