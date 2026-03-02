/**
 * ClaudeKit API domain facade
 * Exports HTTP client, error types, and factory function
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readExistingApiKey } from "@/domains/api-key/index.js";
import { CkApiError } from "./api-error-handler.js";
import { ClaudekitHttpClient } from "./claudekit-http-client.js";

export { ClaudekitHttpClient } from "./claudekit-http-client.js";
export { CkApiError, parseApiError, parseRateLimitHeaders } from "./api-error-handler.js";
export type { CkApiErrorCode } from "./api-error-handler.js";
export type { RequestOptions, ApiResponse } from "./claudekit-http-client.js";

/**
 * Create an authenticated API client using the stored API key
 * Resolves key from ~/.claude/.env automatically
 */
export function createApiClient(claudeDir?: string): ClaudekitHttpClient {
	const dir = claudeDir ?? join(homedir(), ".claude");
	const apiKey = readExistingApiKey(dir);

	if (!apiKey) {
		throw new CkApiError(
			"MISSING_API_KEY",
			"No API key found. Run `ck api setup` to configure your ClaudeKit API key.",
			401,
		);
	}

	return new ClaudekitHttpClient(apiKey);
}
