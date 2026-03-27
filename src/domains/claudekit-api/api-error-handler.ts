/**
 * Typed error handling for ClaudeKit API responses
 */

import type { RateLimitInfo } from "@/types/claudekit-api.js";

export type CkApiErrorCode =
	| "MISSING_API_KEY"
	| "INVALID_API_KEY"
	| "RATE_LIMIT_EXCEEDED"
	| "PATH_NOT_ALLOWED"
	| "UNKNOWN_SERVICE"
	| "INVALID_PATH"
	| "TIMEOUT"
	| "PROXY_ERROR"
	| "LICENSE_REQUIRED"
	| "NETWORK_ERROR";

export class CkApiError extends Error {
	constructor(
		public code: CkApiErrorCode,
		message: string,
		public status: number,
		public retryAfter?: number,
	) {
		super(message);
		this.name = "CkApiError";
	}
}

/**
 * Parse rate limit headers from API response
 */
export function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
	return {
		limit: Number(headers.get("x-ratelimit-limit") ?? 0),
		remaining: Number(headers.get("x-ratelimit-remaining") ?? 0),
		reset: Number(headers.get("x-ratelimit-reset") ?? 0),
		retryAfter: headers.has("retry-after") ? Number(headers.get("retry-after")) : undefined,
	};
}

/**
 * Parse HTTP error response into typed CkApiError
 */
export function parseApiError(status: number, body: unknown): CkApiError {
	const parsed = body as { code?: string; error?: string; message?: string; retryAfter?: number };
	const message = parsed?.message || parsed?.error || `API error (HTTP ${status})`;
	const retryAfter = parsed?.retryAfter;

	// Check for known error codes from response body
	if (parsed?.code && isKnownErrorCode(parsed.code)) {
		return new CkApiError(parsed.code as CkApiErrorCode, message, status, retryAfter);
	}

	// Fall back to HTTP status mapping
	const code = mapStatusToErrorCode(status);
	return new CkApiError(code, message, status, retryAfter);
}

function isKnownErrorCode(code: string): boolean {
	const known: Set<string> = new Set([
		"MISSING_API_KEY",
		"INVALID_API_KEY",
		"RATE_LIMIT_EXCEEDED",
		"PATH_NOT_ALLOWED",
		"UNKNOWN_SERVICE",
		"INVALID_PATH",
		"TIMEOUT",
		"PROXY_ERROR",
		"LICENSE_REQUIRED",
	]);
	return known.has(code);
}

function mapStatusToErrorCode(status: number): CkApiErrorCode {
	if (status === 401) return "INVALID_API_KEY";
	if (status === 403) return "PATH_NOT_ALLOWED";
	if (status === 404) return "UNKNOWN_SERVICE";
	if (status === 429) return "RATE_LIMIT_EXCEEDED";
	if (status === 502) return "PROXY_ERROR";
	if (status === 504) return "TIMEOUT";
	return "NETWORK_ERROR";
}
