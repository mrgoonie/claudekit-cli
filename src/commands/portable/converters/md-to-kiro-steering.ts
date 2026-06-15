/**
 * md-to-kiro-steering converter
 * Converts Claude Code config/rules to Kiro steering format with YAML frontmatter.
 * Used by: Kiro IDE
 */
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

/** Kiro steering inclusion modes */
type KiroInclusionMode = "always" | "fileMatch" | "manual" | "auto";

/** Language/framework to fileMatchPattern glob mapping */
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
 * Determine inclusion mode and optional fileMatchPattern glob
 */
function determineInclusionMode(item: PortableItem): {
	mode: KiroInclusionMode;
	fileMatchPattern?: string;
} {
	// Language-specific rules use fileMatch inclusion with a fileMatchPattern field.
	const languageGlob = detectLanguageGlob(item.name);
	if (languageGlob) {
		return { mode: "fileMatch", fileMatchPattern: languageGlob };
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
			return { mode: "fileMatch", fileMatchPattern: LANGUAGE_GLOB_MAP[lang] };
		}
	}

	// Default to always
	return { mode: "always" };
}

/**
 * Build YAML frontmatter for Kiro steering file.
 * Note: Globs are quoted to handle YAML special characters.
 */
function buildSteeringFrontmatter(mode: KiroInclusionMode, fileMatchPattern?: string): string {
	const lines = ["---"];
	lines.push(`inclusion: ${mode}`);
	if (mode === "fileMatch" && fileMatchPattern) {
		// Quote glob to handle YAML special chars (*, {, })
		lines.push(`fileMatchPattern: "${fileMatchPattern}"`);
	}
	lines.push("---");
	return lines.join("\n");
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

	// Strip Claude-specific references
	const stripped = stripClaudeRefs(item.body, { provider });
	warnings.push(...stripped.warnings);

	// Determine inclusion mode
	const { mode, fileMatchPattern } = determineInclusionMode(item);

	// Build frontmatter
	const frontmatter = buildSteeringFrontmatter(mode, fileMatchPattern);

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
	if (mode === "fileMatch" && fileMatchPattern) {
		warnings.push(`Using fileMatch mode with pattern: ${fileMatchPattern}`);
	}

	return {
		content,
		filename: `${item.name}.md`,
		warnings,
	};
}
