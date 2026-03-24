/**
 * Summarize project documentation for content generation context.
 * Reads all docs/*.md, brand guidelines, writing styles, and README,
 * then sends to Claude CLI for a concise summary.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ContentLogger } from "./content-logger.js";
import { parseClaudeJsonOutput } from "./output-parser.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocsSummaryResult {
	docsSummary: string;
	brandSummary: string;
	stylesSummary: string;
	readmeSummary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max total chars of raw doc content to send to Claude (prevents prompt overflow) */
const MAX_RAW_CONTENT_CHARS = 50_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read all project documentation and generate a concise summary via Claude CLI.
 * Falls back to raw excerpts if Claude summarization fails.
 */
export async function summarizeProjectDocs(
	repoPath: string,
	contentLogger: ContentLogger,
): Promise<DocsSummaryResult> {
	const rawContent = collectRawDocs(repoPath);

	// If very little content, skip Claude call and return raw
	if (rawContent.total.length < 200) {
		return {
			docsSummary: rawContent.docs || "No project documentation found.",
			brandSummary:
				rawContent.brand || "No brand guidelines found. Use a professional, friendly tone.",
			stylesSummary: rawContent.styles || "Use clear, conversational language.",
			readmeSummary: rawContent.readme || "",
		};
	}

	try {
		const prompt = buildSummarizationPrompt(rawContent);
		contentLogger.debug("Summarizing project docs via Claude CLI...");

		const stdout = execSync("claude -p --output-format json --max-turns 3", {
			input: prompt,
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 120000,
		}).toString();

		const parsed = parseClaudeJsonOutput(stdout);
		if (parsed && typeof parsed === "object") {
			const obj = parsed as Record<string, unknown>;
			return {
				docsSummary: String(obj.docsSummary || obj.docs_summary || ""),
				brandSummary: String(obj.brandSummary || obj.brand_summary || rawContent.brand || ""),
				stylesSummary: String(obj.stylesSummary || obj.styles_summary || rawContent.styles || ""),
				readmeSummary: String(obj.readmeSummary || obj.readme_summary || ""),
			};
		}

		contentLogger.warn("Claude summarization returned unexpected format, using raw excerpts.");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		contentLogger.warn(`Claude summarization failed: ${msg}. Using raw excerpts.`);
	}

	// Fallback: truncated raw content
	return {
		docsSummary: rawContent.docs.slice(0, 2000) || "No project documentation found.",
		brandSummary: rawContent.brand.slice(0, 1000) || "No brand guidelines. Use professional tone.",
		stylesSummary: rawContent.styles.slice(0, 500) || "Use clear, conversational language.",
		readmeSummary: rawContent.readme.slice(0, 1000) || "",
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawDocContent {
	docs: string;
	brand: string;
	styles: string;
	readme: string;
	total: string;
}

/** Collect raw content from all documentation sources. */
function collectRawDocs(repoPath: string): RawDocContent {
	let totalChars = 0;

	// Helper: read file and track total size
	const readCapped = (filePath: string, maxChars: number): string => {
		if (!existsSync(filePath)) return "";
		if (totalChars >= MAX_RAW_CONTENT_CHARS) return "";
		const content = readFileSync(filePath, "utf-8");
		const capped = content.slice(0, Math.min(maxChars, MAX_RAW_CONTENT_CHARS - totalChars));
		totalChars += capped.length;
		return capped;
	};

	// docs/*.md files
	const docsContent: string[] = [];
	const docsDir = join(repoPath, "docs");
	if (existsSync(docsDir)) {
		try {
			const files = readdirSync(docsDir)
				.filter((f) => f.endsWith(".md"))
				.sort();
			for (const f of files) {
				const content = readCapped(join(docsDir, f), 5000);
				if (content) {
					docsContent.push(`### ${f}\n${content}`);
				}
			}
		} catch {}
	}
	const docs = docsContent.join("\n\n");

	// Brand guidelines
	let brand = "";
	const brandCandidates = ["docs/brand-guidelines.md", "docs/design-guidelines.md"];
	for (const p of brandCandidates) {
		brand = readCapped(join(repoPath, p), 3000);
		if (brand) break;
	}

	// Writing styles
	let styles = "";
	const stylesDir = join(repoPath, "assets", "writing-styles");
	if (existsSync(stylesDir)) {
		try {
			const files = readdirSync(stylesDir).slice(0, 3);
			styles = files
				.map((f) => readCapped(join(stylesDir, f), 1000))
				.filter(Boolean)
				.join("\n\n");
		} catch {}
	}

	// README.md
	const readme = readCapped(join(repoPath, "README.md"), 3000);

	const total = [docs, brand, styles, readme].join("\n");

	return { docs, brand, styles, readme, total };
}

/** Build the prompt for Claude to summarize the project docs. */
function buildSummarizationPrompt(raw: RawDocContent): string {
	return `You are summarizing a software project's documentation for use as context when generating social media content about development updates.

## Project Documentation
${raw.docs || "(No docs/ directory found)"}

## Brand / Design Guidelines
${raw.brand || "(None found)"}

## Writing Styles
${raw.styles || "(None found)"}

## README
${raw.readme || "(None found)"}

## Instructions
Create a concise summary (each field max 500 chars) covering:
1. docsSummary: What this project does, key features, architecture highlights
2. brandSummary: Brand voice, tone, visual identity guidelines
3. stylesSummary: Writing style rules, language preferences
4. readmeSummary: Project purpose, target audience, key value propositions

Output ONLY valid JSON:
{"docsSummary": "...", "brandSummary": "...", "stylesSummary": "...", "readmeSummary": "..."}`;
}
