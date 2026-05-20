/**
 * FM-strip converter — remove frontmatter, output plain markdown
 * Used by: Windsurf, Goose, Gemini CLI, Amp
 *
 * For merge-single providers (Goose, Gemini CLI, Amp):
 *   Each agent becomes a ## section; installer handles merging.
 * For per-file providers (Windsurf):
 *   Each agent becomes its own plain MD file.
 */
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

/** Providers whose agent body should be rewritten via stripClaudeRefs */
const PROVIDERS_WITH_BODY_REWRITING: ProviderType[] = ["gemini-cli"];

/**
 * Strip frontmatter and return body as plain markdown.
 * For merge-single providers, wraps in a section heading.
 * For Gemini CLI, also rewrites tool names, paths, and slash commands in the body.
 */
export function convertFmStrip(item: PortableItem, provider: ProviderType): ConversionResult {
	const warnings: string[] = [];
	const heading = item.frontmatter.name || item.name;

	// Determine if this provider merges into a single file
	const isMergeProvider = ["goose", "gemini-cli", "amp"].includes(provider);

	// Rewrite body for providers that need Claude-specific refs stripped
	let body = item.body;
	if (PROVIDERS_WITH_BODY_REWRITING.includes(provider)) {
		const stripped = stripClaudeRefs(body, { provider });
		body = stripped.content;
		warnings.push(...stripped.warnings);
	}

	let content: string;
	if (isMergeProvider) {
		// Section with heading for merging into AGENTS.md
		content = `## Agent: ${heading}\n\n${body}\n`;
	} else {
		// Standalone file — include heading
		content = `# ${heading}\n\n${body}\n`;
	}

	// Check Windsurf 12K char limit
	if (provider === "windsurf" && content.length > 12000) {
		const originalLen = content.length;
		const truncated = content.slice(0, 11950);
		content = `${truncated}\n\n[truncated — original ${originalLen} chars exceeded 12K limit]\n`;
		warnings.push(`Content truncated from ${originalLen} to 12K chars for Windsurf`);
	}

	return {
		content,
		filename: isMergeProvider ? "AGENTS.md" : `${item.name}.md`,
		warnings,
	};
}

/**
 * Build a merged AGENTS.md from multiple converted sections
 */
export function buildMergedAgentsMd(sections: string[], providerName: string): string {
	const header = `# Agents\n\n> Ported from Claude Code agents via ClaudeKit CLI (ck agents)\n> Target: ${providerName}\n\n`;
	return header + sections.join("\n---\n\n");
}
