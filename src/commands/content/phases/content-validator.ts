/**
 * Validate generated social media content for quality issues:
 * character limits, markdown formatting, AI-sounding phrases, and hook length.
 */

import type { Platform } from "../types.js";
import type { GeneratedContent } from "./output-parser.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
	valid: boolean;
	issues: string[];
}

// ---------------------------------------------------------------------------
// Quality signal lists
// ---------------------------------------------------------------------------

const AI_PHRASES = [
	"as an ai",
	"i'd be happy to",
	"certainly!",
	"i cannot",
	"let me help",
	"sure thing",
	"of course!",
	"absolutely!",
	"great question",
	"delve into",
	"it's worth noting",
	"in today's fast-paced",
	"game-changer",
	"leverage",
];

const MARKDOWN_PATTERNS = [
	/^#+\s/m, // Headers
	/\*\*[^*]+\*\*/, // Bold
	/\*[^*]+\*/, // Italic
	/^[-*]\s/m, // List items
	/`[^`]+`/, // Code
	/\[[^\]]+\]\([^)]+\)/, // Links
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Validate generated content against platform rules and quality signals. */
export function validateContent(content: GeneratedContent, platform: Platform): ValidationResult {
	const issues: string[] = [];

	// Empty text check
	if (!content.text || content.text.trim().length === 0) {
		issues.push("Content text is empty");
		return { valid: false, issues };
	}

	// Character limit check (skip for threads — each part is validated separately)
	if (platform !== "x_thread") {
		const limit = platform === "facebook" ? 500 : 280;
		if (content.text.length > limit) {
			issues.push(`Text exceeds ${limit} char limit (${content.text.length} chars)`);
		}
	}

	// Markdown formatting check
	for (const pattern of MARKDOWN_PATTERNS) {
		if (pattern.test(content.text)) {
			issues.push("Contains markdown formatting (must be plain text)");
			break;
		}
	}

	// AI slop check
	const lower = content.text.toLowerCase();
	for (const phrase of AI_PHRASES) {
		if (lower.includes(phrase)) {
			issues.push(`Contains AI-sounding phrase: "${phrase}"`);
			break;
		}
	}

	// Hook length check — first sentence should be short and punchy
	const firstSentence = content.text.split(/[.!?]/)[0]?.trim() ?? "";
	if (firstSentence.split(" ").length > 25) {
		issues.push("Hook (first sentence) is too long (>25 words)");
	}

	// Hashtag count check
	const hashtagCount = content.hashtags?.length ?? 0;
	if (platform === "x" && hashtagCount > 5) {
		issues.push("Too many hashtags for X (max 5)");
	}

	return { valid: issues.length === 0, issues };
}
