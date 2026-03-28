/**
 * Input sanitizer — sanitizes untrusted issue/comment content before passing to Claude
 * Defense-in-depth: the real security boundary is tool restriction on Claude
 */

const MAX_INPUT_LENGTH = 8000;

// Prompt injection patterns (best-effort denylist)
const INJECTION_PATTERNS: RegExp[] = [
	/```system[\s\S]*?```/gi,
	/<system[^>]*>[\s\S]*?<\/system>/gi,
	/\[INST\][\s\S]*?\[\/INST\]/gi,
	/Human:|Assistant:|System:/gi,
	/<\|im_start\|>[\s\S]*?<\|im_end\|>/gi,
	/<<SYS>>[\s\S]*?<<\/SYS>>/gi,
];

/**
 * Sanitize raw untrusted input: truncate and strip known injection patterns
 */
export function sanitizeInput(content: string): string {
	let cleaned = content.slice(0, MAX_INPUT_LENGTH);

	for (const pattern of INJECTION_PATTERNS) {
		cleaned = cleaned.replace(pattern, "[REDACTED]");
	}

	if (content.length > MAX_INPUT_LENGTH) {
		cleaned += "\n\n[Content truncated at 8000 characters]";
	}

	return cleaned;
}

/**
 * Wrap sanitized content in untrusted-content tags for Claude prompt framing
 */
export function sanitizeForPrompt(content: string): string {
	const cleaned = sanitizeInput(content);
	return `<untrusted-content>\n${cleaned}\n</untrusted-content>`;
}
