/**
 * HTTP client wrapper for ClaudeKit.cc API
 * Handles auth, rate limiting, timeout, and retry on 429
 */

import type { RateLimitInfo } from "@/types/claudekit-api.js";
import { CkApiError, parseApiError, parseRateLimitHeaders } from "./api-error-handler.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;

export interface RequestOptions {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	query?: Record<string, string>;
	timeoutMs?: number;
}

export interface ApiResponse<T> {
	data: T;
	rateLimit: RateLimitInfo;
	status: number;
}

function getBaseUrl(): string {
	return (process.env.CK_BASE_URL ?? "https://claudekit.cc").replace(/\/$/, "");
}

export class ClaudekitHttpClient {
	private baseUrl: string;

	constructor(
		private apiKey: string,
		baseUrl?: string,
	) {
		this.baseUrl = baseUrl ?? getBaseUrl();
	}

	/**
	 * Make an authenticated API request with automatic retry on 429
	 */
	async request<T>(path: string, opts?: RequestOptions): Promise<ApiResponse<T>> {
		return this.withRetry(() => this.doRequest<T>(path, opts));
	}

	private async doRequest<T>(path: string, opts?: RequestOptions): Promise<ApiResponse<T>> {
		const method = opts?.method ?? "GET";
		const timeoutMs = Math.min(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

		// Build URL with query params
		const url = new URL(path, this.baseUrl);
		if (opts?.query) {
			for (const [key, value] of Object.entries(opts.query)) {
				url.searchParams.set(key, value);
			}
		}

		// Setup abort controller for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const headers: Record<string, string> = {
				"x-api-key": this.apiKey,
				Accept: "application/json",
			};
			if (opts?.body) {
				headers["Content-Type"] = "application/json";
			}

			const response = await fetch(url.toString(), {
				method,
				headers,
				body: opts?.body ? JSON.stringify(opts.body) : undefined,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			const rateLimit = parseRateLimitHeaders(response.headers);

			if (!response.ok) {
				let body: unknown;
				try {
					body = await response.json();
				} catch {
					body = { message: response.statusText };
				}
				const error = parseApiError(response.status, body);
				// Attach rate limit info for 429 retry logic
				if (error.code === "RATE_LIMIT_EXCEEDED" && rateLimit.retryAfter) {
					error.retryAfter = rateLimit.retryAfter;
				}
				throw error;
			}

			const data = (await response.json()) as T;
			return { data, rateLimit, status: response.status };
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof CkApiError) throw error;
			if (error instanceof Error && error.name === "AbortError") {
				throw new CkApiError("TIMEOUT", "Request timed out", 504);
			}
			throw new CkApiError(
				"NETWORK_ERROR",
				error instanceof Error ? error.message : "Network error",
				0,
			);
		}
	}

	private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
		try {
			return await fn();
		} catch (error) {
			if (error instanceof CkApiError && error.code === "RATE_LIMIT_EXCEEDED" && error.retryAfter) {
				const delayMs = error.retryAfter * 1000;
				await new Promise((resolve) => setTimeout(resolve, delayMs));
				return fn(); // single retry — no further catch
			}
			throw error;
		}
	}
}
