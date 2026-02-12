/**
 * Frontmatter parser — wraps gray-matter for parsing MD+YAML frontmatter
 * Used by agents-discovery and commands-discovery to parse source files.
 */
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { logger } from "../../shared/logger.js";
import type { FrontmatterParseResult, ParsedFrontmatter } from "./types.js";

/** Maximum lengths for frontmatter field values */
const FRONTMATTER_LIMITS: Record<string, number> = {
	name: 200,
	description: 500,
	model: 100,
	tools: 1000,
	memory: 50,
	argumentHint: 500,
};

function truncateField(value: string, field: string, warnings: string[]): string {
	const limit = FRONTMATTER_LIMITS[field];
	if (limit && value.length > limit) {
		warnings.push(`Frontmatter field "${field}" truncated to ${limit} characters`);
		return value.slice(0, limit);
	}
	return value;
}

/**
 * Parse frontmatter and body from markdown content string
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
	try {
		const { data, content: body } = matter(content);
		const frontmatter: ParsedFrontmatter = {};
		const warnings: string[] = [];

		if (data.name) frontmatter.name = truncateField(String(data.name), "name", warnings);
		if (data.description)
			frontmatter.description = truncateField(String(data.description), "description", warnings);
		if (data.model) frontmatter.model = truncateField(String(data.model), "model", warnings);
		if (data.tools) frontmatter.tools = truncateField(String(data.tools), "tools", warnings);
		if (data.memory) frontmatter.memory = truncateField(String(data.memory), "memory", warnings);
		if (data["argument-hint"])
			frontmatter.argumentHint = truncateField(
				String(data["argument-hint"]),
				"argumentHint",
				warnings,
			);

		// Preserve any extra fields
		for (const [key, value] of Object.entries(data)) {
			if (!(key in frontmatter) && key !== "argument-hint") {
				frontmatter[key] = value;
			}
		}

		return { frontmatter, body: body.trim(), warnings };
	} catch (error) {
		logger.warning(
			`Failed to parse frontmatter: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return { frontmatter: {}, body: content.trim(), warnings: [] };
	}
}

/**
 * Parse frontmatter from a file path
 */
export async function parseFrontmatterFile(filePath: string): Promise<FrontmatterParseResult> {
	const content = await readFile(filePath, "utf-8");
	return parseFrontmatter(content);
}
