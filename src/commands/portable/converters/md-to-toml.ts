/**
 * MD-to-TOML converter — convert Claude Code commands to Gemini CLI TOML format
 * Used by: Gemini CLI (.gemini/commands/*.toml)
 *
 * Gemini CLI TOML format:
 *   description = "..."
 *   prompt = """..."""
 *
 * Special syntax mapping:
 *   $ARGUMENTS -> {{args}}
 */
import type { ConversionResult, PortableItem } from "../types.js";

/**
 * Escape a string for TOML triple-quoted string
 */
function escapeTomlMultiline(str: string): string {
	// Triple-quoted strings in TOML handle most escaping automatically
	// Just need to ensure no triple quotes appear in the content
	return str.replace(/"""/g, '"\\"\\""');
}

/**
 * Convert Claude Code $ARGUMENTS placeholder to Gemini CLI {{args}}
 */
function mapPlaceholders(body: string): string {
	return body.replace(/\$ARGUMENTS/g, "{{args}}");
}

/**
 * Convert a Claude Code command to Gemini CLI TOML format
 */
export function convertMdToToml(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const description = item.description || item.frontmatter.description || "";
	const prompt = mapPlaceholders(item.body);

	const lines: string[] = [];
	if (description) {
		lines.push(`description = ${JSON.stringify(description)}`);
	}
	lines.push(`prompt = """\n${escapeTomlMultiline(prompt)}\n"""`);

	// Handle nested commands — flatten path segments to filename
	const filename = item.segments ? `${item.segments.join("-")}.toml` : `${item.name}.toml`;

	return {
		content: lines.join("\n"),
		filename,
		warnings,
	};
}
