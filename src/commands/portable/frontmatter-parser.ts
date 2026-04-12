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

/** Known frontmatter keys that map to ParsedFrontmatter fields */
const KNOWN_KEYS: Record<string, keyof ParsedFrontmatter> = {
	name: "name",
	description: "description",
	model: "model",
	tools: "tools",
	memory: "memory",
	"argument-hint": "argumentHint",
};

function normalizeFrontmatterInput(content: string): string {
	return content.replace(/^\uFEFF/, "");
}

/**
 * Regex-based fallback parser for when gray-matter/js-yaml fails on
 * unquoted YAML values containing colons, brackets, or other special chars.
 * Extracts simple key: value pairs from the frontmatter block.
 */
function parseFrontmatterFallback(content: string): FrontmatterParseResult | null {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return null;

	const fmBlock = fmMatch[1];
	const body = content.slice(fmMatch[0].length);
	const frontmatter: ParsedFrontmatter = {};
	const warnings: string[] = [];

	// Match key: value lines (value runs to end of line or next key)
	// Handles single-quoted, double-quoted, and unquoted values
	const lines = fmBlock.split(/\r?\n/);
	for (const line of lines) {
		const keyMatch = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)/);
		if (!keyMatch) continue;

		const [, rawKey, rawValue] = keyMatch;
		// Strip surrounding quotes (single or double)
		const value = rawValue.replace(/^(['"])(.*)\1$/, "$2").trim();
		if (!value) continue;

		const mappedKey = KNOWN_KEYS[rawKey];
		if (mappedKey) {
			frontmatter[mappedKey] = truncateField(value, String(mappedKey), warnings);
		} else {
			frontmatter[rawKey] = value;
		}
	}

	return { frontmatter, body: body.trim(), warnings };
}

/**
 * Parse frontmatter and body from markdown content string
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
	const normalizedContent = normalizeFrontmatterInput(content);

	try {
		const { data, content: body } = matter(normalizedContent, {
			engines: { javascript: { parse: () => ({}) } },
		});
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
		// gray-matter failed (e.g. unquoted YAML values with colons/brackets).
		// Try regex-based fallback before giving up.
		const fallback = parseFrontmatterFallback(normalizedContent);
		if (fallback && Object.keys(fallback.frontmatter).length > 0) {
			logger.verbose(
				`Failed to parse frontmatter: ${error instanceof Error ? error.message : "Unknown error"} (recovered via fallback)`,
			);
			return fallback;
		}

		logger.warning(
			`Failed to parse frontmatter: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
		return { frontmatter: {}, body: normalizedContent.trim(), warnings: [] };
	}
}

/**
 * Parse frontmatter from a file path
 */
export async function parseFrontmatterFile(filePath: string): Promise<FrontmatterParseResult> {
	const content = await readFile(filePath, "utf-8");
	return parseFrontmatter(content);
}
