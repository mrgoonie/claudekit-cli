/**
 * API key and configuration value validation patterns
 */
export const VALIDATION_PATTERNS = {
	GEMINI_API_KEY: /^AIza[0-9A-Za-z_-]{35,}$/,
	DISCORD_WEBHOOK_URL: /^https:\/\/discord\.com\/api\/webhooks\//,
	TELEGRAM_BOT_TOKEN: /^\d+:[A-Za-z0-9_-]{35}$/,
};

/**
 * Validate an API key or configuration value against a pattern
 */
export function validateApiKey(value: string, pattern: RegExp): boolean {
	return pattern.test(value);
}
