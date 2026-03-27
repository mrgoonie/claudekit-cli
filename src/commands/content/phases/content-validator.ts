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
// Character counting
// ---------------------------------------------------------------------------

/**
 * Approximate X/Twitter weighted character count.
 * URLs count as 23 chars. CJK/Japanese/fullwidth characters count as 2. Others as 1.
 * Simplified version of https://developer.x.com/en/docs/counting-characters
 */
function countTwitterChars(text: string): number {
	const urlPattern = /https?:\/\/\S+/g;
	const urlCount = (text.match(urlPattern) || []).length;
	const withoutUrls = text.replace(urlPattern, "");

	let count = urlCount * 23;

	for (const char of withoutUrls) {
		const cp = char.codePointAt(0) ?? 0;
		if (
			(cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
			(cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
			(cp >= 0x20000 && cp <= 0x2a6df) || // CJK Extension B
			(cp >= 0x2a700 && cp <= 0x2ebef) || // CJK Extensions C-F
			(cp >= 0x30000 && cp <= 0x323af) || // CJK Extension G-H
			(cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility
			(cp >= 0x3000 && cp <= 0x303f) || // CJK Symbols
			(cp >= 0x3040 && cp <= 0x309f) || // Hiragana
			(cp >= 0x30a0 && cp <= 0x30ff) || // Katakana
			(cp >= 0xff00 && cp <= 0xffef) // Fullwidth Forms
		) {
			count += 2;
		} else {
			count += 1;
		}
	}

	return count;
}

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
		// Use weighted counting for X (CJK = 2 chars, URLs = 23 chars)
		const charCount = platform === "x" ? countTwitterChars(content.text) : content.text.length;
		if (charCount > limit) {
			issues.push(`Text exceeds ${limit} char limit (${charCount} weighted chars)`);
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
