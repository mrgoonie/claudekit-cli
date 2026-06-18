/**
 * Direct copy converter — copies content with optional .claude/ path replacement
 * Used by: Droid, Windsurf (commands), Antigravity (commands/skills), and simple copy targets
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import matter from "gray-matter";
import { normalizeCodexHookContent } from "../hook-migration-compatibility.js";
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";

/**
 * Map of provider → config directory prefix for .claude/ path replacement.
 * Providers not listed here (or claude-code itself) get no replacement.
 */
const PROVIDER_CONFIG_DIR: Partial<Record<ProviderType, string>> = {
	opencode: ".opencode/",
	droid: ".factory/",
	windsurf: ".windsurf/",
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

function rewriteKiroPaths(content: string): string {
	return content
		.replace(/\.claude\/skills\//g, ".kiro/skills/")
		.replace(/\.claude\/agents\//g, ".kiro/agents/")
		.replace(/\.claude\/rules\//g, ".kiro/steering/")
		.replace(/\.claude\/commands\//g, "Claude Code commands/")
		.replace(/\.claude\/hooks\//g, "Claude Code hooks/");
}

function splitTrailingPunctuation(pathSuffix: string): { itemPath: string; punctuation: string } {
	const match = pathSuffix.match(/^(.+?)([.,;:!?]+)?$/);
	return {
		itemPath: match?.[1] ?? pathSuffix,
		punctuation: match?.[2] ?? "",
	};
}

export function rewriteAntigravityCommandRefSuffix(suffix: string): string {
	const { itemPath, punctuation } = splitTrailingPunctuation(suffix);
	const extIdx = itemPath.lastIndexOf(".");
	const ext = extIdx >= 0 ? itemPath.substring(extIdx) : "";
	const nameWithoutExt = extIdx >= 0 ? itemPath.substring(0, extIdx) : itemPath;
	return `${nameWithoutExt.replace(/[\\/]+/g, "-")}${ext}${punctuation}`;
}

export function rewriteAntigravityPaths(
	content: string,
	options: { global?: boolean } = {},
): string {
	const skillsBase = options.global ? "~/.gemini/config/skills/" : ".agents/skills/";
	return content
		.replace(/\.claude\/agents\/([a-zA-Z0-9_./-]+)/g, (_matched, suffix: string) => {
			const { punctuation } = splitTrailingPunctuation(suffix);
			return `.agents/agents.md${punctuation}`;
		})
		.replace(/\.claude\/commands\/([a-zA-Z0-9_./-]+)/g, (_matched, suffix: string) => {
			return `.agents/workflows/${rewriteAntigravityCommandRefSuffix(suffix)}`;
		})
		.replace(/\.claude\/skills\//g, skillsBase)
		.replace(/\.claude\/rules\//g, ".agents/rules/")
		.replace(/\.claude\/agents\//g, ".agents/agents.md")
		.replace(/\.claude\/commands\//g, ".agents/workflows/")
		.replace(/\.claude\/hooks\//g, "Claude Code hooks/");
}

/**
 * Return the file content, replacing .claude/ paths for non-Claude providers.
 */
export function convertDirectCopy(
	item: PortableItem,
	provider?: ProviderType,
	options: { global?: boolean } = {},
): ConversionResult {
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
		if (provider === "kiro") {
			content = rewriteKiroPaths(content);
		} else if (provider === "antigravity") {
			content = rewriteAntigravityPaths(content, options);
		} else {
			const targetDir = PROVIDER_CONFIG_DIR[provider];
			if (targetDir) {
				content = content.replace(/\.claude\//g, targetDir);
			}
		}
	}
	if (provider === "codex" && item.type === "hooks") {
		content = normalizeCodexHookContent(content);
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
