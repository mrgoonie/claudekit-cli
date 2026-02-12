/**
 * Frontmatter parser — wraps gray-matter for parsing MD+YAML frontmatter
 * Used by agents-discovery and commands-discovery to parse source files.
 */
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { logger } from "../../shared/logger.js";
import type { ParsedFrontmatter } from "./types.js";

/**
 * Parse frontmatter and body from markdown content string
 */
export function parseFrontmatter(content: string): {
	frontmatter: ParsedFrontmatter;
	body: string;
} {
	try {
		const { data, content: body } = matter(content);
		const frontmatter: ParsedFrontmatter = {};

		if (data.name) frontmatter.name = String(data.name);
		if (data.description) frontmatter.description = String(data.description);
		if (data.model) frontmatter.model = String(data.model);
		if (data.tools) frontmatter.tools = String(data.tools);
		if (data.memory) frontmatter.memory = String(data.memory);
		if (data["argument-hint"]) frontmatter.argumentHint = String(data["argument-hint"]);

		// Preserve any extra fields
		for (const [key, value] of Object.entries(data)) {
			if (!(key in frontmatter) && key !== "argument-hint") {
				frontmatter[key] = value;
			}
		}

		return { frontmatter, body: body.trim() };
	} catch (error) {
		logger.warning(
			`Failed to parse frontmatter: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return { frontmatter: {}, body: content.trim() };
	}
}

/**
 * Parse frontmatter from a file path
 */
export async function parseFrontmatterFile(filePath: string): Promise<{
	frontmatter: ParsedFrontmatter;
	body: string;
}> {
	const content = await readFile(filePath, "utf-8");
	return parseFrontmatter(content);
}
