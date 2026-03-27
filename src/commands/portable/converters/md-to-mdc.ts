/**
 * Converts stripped markdown to Cursor MDC format (YAML frontmatter + body)
 * Used only by Cursor for config/rules porting
 */

import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

/**
 * Convert a portable item to Cursor MDC format
 * @param item - The portable item to convert
 * @param provider - Target provider type (unused but required for consistency)
 * @returns Conversion result with MDC content and warnings
 */
export function convertMdToMdc(item: PortableItem, provider: ProviderType): ConversionResult {
	// Strip Claude-specific references from markdown body
	const stripped = stripClaudeRefs(item.body, { provider });

	// Generate description from item data
	const description = item.description || formatDescription(item.name);
	const escapedDesc = description.replace(/"/g, '\\"');

	// Build MDC format: YAML frontmatter + markdown body
	const content = [
		"---",
		`description: "${escapedDesc}"`,
		"alwaysApply: true",
		"---",
		"",
		stripped.content,
	].join("\n");

	return {
		content,
		filename: `${item.name}.mdc`,
		warnings: stripped.warnings,
	};
}

/**
 * Format item name into human-readable description
 * @param name - Item name (e.g., "project-config")
 * @returns Formatted description (e.g., "Project Config rules")
 */
function formatDescription(name: string): string {
	return `${name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} rules`;
}
