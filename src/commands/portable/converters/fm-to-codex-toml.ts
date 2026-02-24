/**
 * FM-to-Codex-TOML converter — convert Claude Code agents to Codex TOML multi-agent format
 * Used by: Codex (.codex/agents/*.toml + config.toml registry entries)
 *
 * Generates per-agent TOML with developer_instructions, sandbox_mode, model hints.
 * Separate helper builds [agents.X] registry entries for config.toml.
 */
import { createHash } from "node:crypto";
import type { ConversionResult, PortableItem } from "../types.js";
import { escapeTomlMultiline } from "./md-to-toml.js";

const MAX_CODEX_SLUG_LENGTH = 96;

function shortHash(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

/** Convert kebab-case agent name to snake_case TOML table key */
export function toCodexSlug(name: string): string {
	// Strip combining diacritical marks after NFKD decomposition
	// biome-ignore lint/suspicious/noMisleadingCharacterClass: intentional combining char range for diacritic stripping
	const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

	let slug = normalized
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();

	if (!slug) {
		slug = `agent_${shortHash(name)}`;
	}

	if (slug.length > MAX_CODEX_SLUG_LENGTH) {
		slug = slug.slice(0, MAX_CODEX_SLUG_LENGTH).replace(/_+$/g, "");
	}

	if (!slug) {
		return `agent_${shortHash(name)}`;
	}

	return slug;
}

/** Derive Codex sandbox_mode from Claude Code tools string */
function deriveSandboxMode(tools: unknown): { sandboxMode: string | null; warning?: string } {
	if (tools === undefined || tools === null) {
		return { sandboxMode: null };
	}

	if (typeof tools !== "string") {
		return {
			sandboxMode: null,
			warning: `Ignored non-string tools frontmatter (${typeof tools}) while deriving sandbox_mode`,
		};
	}

	if (!tools.trim()) {
		return { sandboxMode: null };
	}

	const toolList = tools
		.split(/[,;|]/)
		.map((t) =>
			t
				.trim()
				.toLowerCase()
				.replace(/\(.*\)$/, ""),
		)
		.filter(Boolean);

	// Task spawns subagents that may write — conservative classification to avoid
	// under-permissive sandbox_mode when agents delegate write operations
	const hasWrite = toolList.some((t) =>
		["bash", "write", "edit", "multiedit", "notebookedit", "apply_patch", "task"].includes(t),
	);
	const hasRead = toolList.some((t) => ["read", "grep", "glob", "ls", "search"].includes(t));

	if (hasWrite) return { sandboxMode: "workspace-write" };
	if (hasRead) return { sandboxMode: "read-only" };

	return {
		sandboxMode: null,
		warning: `No known read/write tool found in tools frontmatter: "${tools}"`,
	};
}

/** Convert a Claude Code agent to Codex per-agent TOML content */
export function convertFmToCodexToml(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const slug = toCodexSlug(item.name);
	const lines: string[] = [];

	// Model hint (commented — user should configure their own model)
	if (item.frontmatter.model !== undefined && item.frontmatter.model !== null) {
		if (typeof item.frontmatter.model === "string" && item.frontmatter.model.trim().length > 0) {
			lines.push(`# model = ${JSON.stringify(item.frontmatter.model.trim())}`);
		} else if (typeof item.frontmatter.model !== "string") {
			warnings.push(
				`Ignored non-string model frontmatter (${typeof item.frontmatter.model}) for "${item.name}"`,
			);
		}
	}

	// Sandbox mode derived from tools
	const sandboxResult = deriveSandboxMode(item.frontmatter.tools);
	if (sandboxResult.warning) {
		warnings.push(sandboxResult.warning);
	}
	if (sandboxResult.sandboxMode) {
		lines.push(`sandbox_mode = "${sandboxResult.sandboxMode}"`);
	}

	// Developer instructions (the agent's core prompt)
	const body = item.body.trim();
	if (body.length === 0) {
		warnings.push(`Agent "${item.name}" has empty body; writing empty developer_instructions`);
	}
	if (lines.length > 0) {
		lines.push("");
	}
	lines.push(`developer_instructions = """\n${escapeTomlMultiline(body)}\n"""`);

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
