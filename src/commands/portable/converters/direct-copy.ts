/**
 * Direct copy converter — no transformation needed
 * Used by: OpenCode (agents + commands), Codex (commands)
 */
import { readFileSync } from "node:fs";
import matter from "gray-matter";
import type { ConversionResult, PortableItem } from "../types.js";

/**
 * Return the original file content as-is (frontmatter + body)
 */
export function convertDirectCopy(item: PortableItem): ConversionResult {
	// Preserve source content byte-for-byte when available.
	// This avoids gray-matter re-parsing malformed legacy frontmatter.
	let content: string;
	try {
		content = readFileSync(item.sourcePath, "utf-8");
	} catch {
		// Fallback for synthetic items in tests or missing sources.
		// If stringify fails on malformed body, keep raw body as last resort.
		try {
			content = matter.stringify(item.body, item.frontmatter);
		} catch {
			content = item.body;
		}
	}
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
