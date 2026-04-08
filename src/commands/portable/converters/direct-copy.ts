/**
 * Direct copy converter — copies content with optional .claude/ path replacement
 * Used by: Codex (commands/skills), Droid, Windsurf (commands), Antigravity (commands/skills)
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import matter from "gray-matter";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

/**
 * Map of provider → config directory prefix for .claude/ path replacement.
 * Providers not listed here (or claude-code itself) get no replacement.
 */
const PROVIDER_CONFIG_DIR: Partial<Record<ProviderType, string>> = {
	opencode: ".opencode/",
	droid: ".factory/",
	windsurf: ".windsurf/",
	antigravity: ".agent/",
	cursor: ".cursor/",
	roo: ".roo/",
	kilo: ".kilocode/",
	goose: ".goose/",
	"gemini-cli": ".gemini/",
	amp: ".agents/",
	cline: ".cline/",
	openhands: ".openhands/",
	codex: ".codex/",
	"github-copilot": ".github/",
};

/**
 * Return the file content, replacing .claude/ paths for non-Claude providers.
 */
export function convertDirectCopy(item: PortableItem, provider?: ProviderType): ConversionResult {
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

	// Replace .claude/ paths with provider-specific config dir
	if (provider && provider !== "claude-code") {
		const targetDir = PROVIDER_CONFIG_DIR[provider];
		if (targetDir) {
			content = content.replace(/\.claude\//g, targetDir);
		}
	}

	// Preserve nested path namespace (docs/init.md) to avoid filename collisions.
	const namespacedName =
		item.name.includes("/") || item.name.includes("\\")
			? item.name.replace(/\\/g, "/")
			: item.segments && item.segments.length > 0
				? item.segments.join("/")
				: item.name;
	const sourceExtension = extname(item.sourcePath);
	let filename: string;
	if (sourceExtension) {
		filename = namespacedName.toLowerCase().endsWith(sourceExtension.toLowerCase())
			? namespacedName
			: `${namespacedName}${sourceExtension}`;
	} else {
		filename = namespacedName.includes(".") ? namespacedName : `${namespacedName}.md`;
	}
	return {
		content,
		filename,
		warnings: [],
	};
}
