/**
 * API key validation against ClaudeKit API
 */

const API_BASE_URL = "https://claudekit.cc/api";
const VALIDATION_TIMEOUT = 10000; // 10 seconds

export interface ValidationResult {
	valid: boolean;
	userId?: string;
	rateLimit?: number;
	error?: string;
}

/**
 * Validate an API key against the ClaudeKit API
 */
export async function validateApiKey(apiKey: string): Promise<ValidationResult> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

		const response = await fetch(`${API_BASE_URL}/keys/validate`, {
			method: "POST",
			headers: {
				"x-api-key": apiKey,
				"Content-Type": "application/json",
			},
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		const data = (await response.json()) as {
			valid?: boolean;
			userId?: string;
			rateLimit?: number;
			error?: string;
		};

		if (data.valid) {
			return {
				valid: true,
				userId: data.userId,
				rateLimit: data.rateLimit,
			};
		}
		return {
			valid: false,
			error: data.error || "Invalid API key",
		};
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return {
				valid: false,
				error: "Validation timed out. Check your network connection.",
			};
		}
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Network error",
		};
	}
}

/**
 * Check if API key format is valid
 * Format: ck_live_ + 32 base64url characters
 */
export function isValidKeyFormat(key: string): boolean {
	return /^ck_live_[A-Za-z0-9_-]{32}$/.test(key);
}
