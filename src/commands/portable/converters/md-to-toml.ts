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
export function escapeTomlMultiline(str: string): string {
	// In TOML multi-line basic strings, backslash is the escape character.
	// Escape existing backslashes first so they appear literally.
	let escaped = str.replace(/\\/g, "\\\\");
	// Break up any triple-quote sequences that would close the string early
	escaped = escaped.replace(/"""/g, '""\\"');
	// Trailing quote(s) would merge with closing """, add newline separator
	if (escaped.endsWith('"')) {
		escaped += "\n";
	}
	return escaped;
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

	// Preserve nested path namespace to keep command IDs collision-free.
	const namespacedName =
		item.name.includes("/") || item.name.includes("\\")
			? item.name.replace(/\\/g, "/")
			: item.segments && item.segments.length > 0
				? item.segments.join("/")
				: item.name;
	const filename = `${namespacedName}.toml`;

	return {
		content: lines.join("\n"),
		filename,
		warnings,
	};
}
