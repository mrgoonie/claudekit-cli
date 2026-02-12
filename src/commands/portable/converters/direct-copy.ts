/**
 * Direct copy converter — no transformation needed
 * Used by: OpenCode (agents + commands), Codex (commands)
 */
import matter from "gray-matter";
import type { ConversionResult, PortableItem } from "../types.js";

/**
 * Return the original file content as-is (frontmatter + body)
 */
export function convertDirectCopy(item: PortableItem): ConversionResult {
	// Reconstruct the original file with frontmatter
	const content = matter.stringify(item.body, item.frontmatter);
	return {
		content,
		filename: `${item.name}.md`,
		warnings: [],
	};
}
