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
	// Preserve nested path namespace (docs/init.md) to avoid filename collisions.
	const namespacedName =
		item.name.includes("/") || item.name.includes("\\")
			? item.name.replace(/\\/g, "/")
			: item.segments && item.segments.length > 0
				? item.segments.join("/")
				: item.name;
	const filename = `${namespacedName}.md`;
	return {
		content,
		filename,
		warnings: [],
	};
}
