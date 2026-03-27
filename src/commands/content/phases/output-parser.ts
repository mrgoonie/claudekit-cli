/**
 * Parse Claude CLI JSON output using a 4-strategy cascade.
 * Handles raw JSON, code blocks, embedded JSON objects, and plain text fallbacks.
 */

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/** Parse Claude CLI stdout that may contain JSON via 4-strategy cascade. */
export function parseClaudeJsonOutput(stdout: string): unknown {
	// Strategy 1: Direct JSON parse
	try {
		return JSON.parse(stdout.trim());
	} catch {
		/* try next */
	}

	// Strategy 2: Extract from code block
	const codeBlockMatch = stdout.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
	if (codeBlockMatch) {
		try {
			return JSON.parse(codeBlockMatch[1].trim());
		} catch {
			/* try next */
		}
	}

	// Strategy 3: Find JSON-like object in text
	const jsonMatch = stdout.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		try {
			return JSON.parse(jsonMatch[0]);
		} catch {
			/* try next */
		}
	}

	// Strategy 4: Return as plain text wrapped in object
	return { text: stdout.trim(), hashtags: [], hook: "", cta: "" };
}

// ---------------------------------------------------------------------------
// Typed extraction
// ---------------------------------------------------------------------------

export interface GeneratedContent {
	text: string;
	hashtags: string[];
	hook: string;
	cta: string;
	mediaPrompt?: string;
}

/** Extract typed content fields from a parsed Claude response object. */
export function extractContentFromResponse(response: unknown): GeneratedContent {
	if (!response || typeof response !== "object") {
		return { text: String(response || ""), hashtags: [], hook: "", cta: "" };
	}
	const obj = response as Record<string, unknown>;
	return {
		text: String(obj.text || ""),
		hashtags: Array.isArray(obj.hashtags) ? obj.hashtags.map(String) : [],
		hook: String(obj.hook || ""),
		cta: String(obj.cta || ""),
		mediaPrompt: obj.mediaPrompt ? String(obj.mediaPrompt) : undefined,
	};
}
