/**
 * md-to-kiro-steering converter
 * Converts Claude Code config/rules/agents to Kiro steering format with YAML frontmatter.
 * Used by: Kiro IDE
 */
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

/** Kiro steering inclusion modes */
type KiroInclusionMode = "always" | "fileMatch" | "manual" | "auto";

/** Language/framework to fileMatch glob mapping */
const LANGUAGE_GLOB_MAP: Record<string, string> = {
	typescript: "**/*.{ts,tsx}",
	javascript: "**/*.{js,jsx,mjs,cjs}",
	python: "**/*.py",
	rust: "**/*.rs",
	go: "**/*.go",
	java: "**/*.java",
	kotlin: "**/*.kt",
	swift: "**/*.swift",
	ruby: "**/*.rb",
	php: "**/*.php",
	css: "**/*.{css,scss,sass,less}",
	html: "**/*.{html,htm}",
	markdown: "**/*.md",
	json: "**/*.json",
	yaml: "**/*.{yml,yaml}",
	shell: "**/*.{sh,bash,zsh}",
	react: "**/*.{tsx,jsx}",
	vue: "**/*.vue",
	svelte: "**/*.svelte",
};

/** Agent frontmatter fields that have no Kiro equivalent */
const UNSUPPORTED_AGENT_FIELDS = ["model", "tools", "memory", "argumentHint"];

/**
 * Detect if item name suggests a language/framework-specific rule.
 * Uses word boundary matching to avoid false positives (e.g., "java" matching "javascript").
 */
function detectLanguageGlob(itemName: string): string | null {
	const normalized = itemName.toLowerCase();

	// Sort by length descending to match longer terms first (e.g., "javascript" before "java")
	const sortedLangs = Object.keys(LANGUAGE_GLOB_MAP).sort((a, b) => b.length - a.length);

	for (const lang of sortedLangs) {
		// Match exact name, or as word boundary (prefix/suffix with hyphen/underscore)
		const patterns = [
			new RegExp(`^${lang}$`), // exact match
			new RegExp(`^${lang}[-_]`), // prefix: "typescript-rules"
			new RegExp(`[-_]${lang}$`), // suffix: "rules-typescript"
			new RegExp(`[-_]${lang}[-_]`), // middle: "my-typescript-rules"
		];

		if (patterns.some((p) => p.test(normalized))) {
			return LANGUAGE_GLOB_MAP[lang];
		}
	}
	return null;
}

/**
 * Determine inclusion mode and optional fileMatch pattern
 */
function determineInclusionMode(item: PortableItem): {
	mode: KiroInclusionMode;
	fileMatch?: string;
} {
	// Language-specific rules use fileMatch
	const languageGlob = detectLanguageGlob(item.name);
	if (languageGlob) {
		return { mode: "fileMatch", fileMatch: languageGlob };
	}

	// Check description for language hints
	const fmDescription = String(item.frontmatter.description || "").toLowerCase();
	const sortedLangs = Object.keys(LANGUAGE_GLOB_MAP).sort((a, b) => b.length - a.length);

	for (const lang of sortedLangs) {
		if (
			fmDescription.includes(` ${lang} `) ||
			fmDescription.startsWith(`${lang} `) ||
			fmDescription.endsWith(` ${lang}`)
		) {
			return { mode: "fileMatch", fileMatch: LANGUAGE_GLOB_MAP[lang] };
		}
	}

	// Default to always
	return { mode: "always" };
}

/**
 * Build YAML frontmatter for Kiro steering file.
 * Note: Globs are quoted to handle YAML special characters.
 */
function buildSteeringFrontmatter(mode: KiroInclusionMode, fileMatch?: string): string {
	const lines = ["---"];
	lines.push(`inclusion: ${mode}`);
	if (mode === "fileMatch" && fileMatch) {
		// Quote glob to handle YAML special chars (*, {, })
		lines.push(`fileMatch: "${fileMatch}"`);
	}
	lines.push("---");
	return lines.join("\n");
}

/**
 * Check for unsupported agent frontmatter fields
 */
function checkUnsupportedFields(item: PortableItem): string[] {
	const warnings: string[] = [];
	const presentFields = UNSUPPORTED_AGENT_FIELDS.filter(
		(field) => item.frontmatter[field] !== undefined,
	);

	if (presentFields.length > 0) {
		warnings.push(`Agent metadata not supported by Kiro (dropped): ${presentFields.join(", ")}`);
	}

	return warnings;
}

/**
 * Check if body already starts with a heading (any level h1-h6)
 */
function bodyStartsWithHeading(body: string): boolean {
	const trimmed = body.trimStart();
	return /^#{1,6}\s+/.test(trimmed);
}

/**
 * Convert to Kiro steering format
 */
export function convertMdToKiroSteering(
	item: PortableItem,
	provider: ProviderType,
): ConversionResult {
	const warnings: string[] = [];

	// Check for unsupported agent fields
	if (item.type === "agent") {
		warnings.push(...checkUnsupportedFields(item));
	}

	// Strip Claude-specific references
	const stripped = stripClaudeRefs(item.body, { provider });
	warnings.push(...stripped.warnings);

	// Determine inclusion mode
	const { mode, fileMatch } = determineInclusionMode(item);

	// Build frontmatter
	const frontmatter = buildSteeringFrontmatter(mode, fileMatch);

	// Compose content — skip heading injection if body already has one
	const heading = item.frontmatter.name || item.name;
	const hasExistingHeading = bodyStartsWithHeading(stripped.content);

	let content: string;
	if (hasExistingHeading) {
		content = `${frontmatter}\n\n${stripped.content}\n`;
	} else {
		content = `${frontmatter}\n\n# ${heading}\n\n${stripped.content}\n`;
	}

	// Add info about inclusion mode
	if (mode === "fileMatch" && fileMatch) {
		warnings.push(`Using fileMatch mode with pattern: ${fileMatch}`);
	}

	return {
		content,
		filename: `${item.name}.md`,
		warnings,
	};
}
