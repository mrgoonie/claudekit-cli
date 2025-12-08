import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

// Store original values
const originalEnv = process.env;
const originalFetch = global.fetch;

describe("NetworkChecker", () => {
	let mockFetch: ReturnType<typeof mock>;

	beforeEach(() => {
		// Reset process.env and ensure we're not in test mode
		process.env = { ...originalEnv };
		process.env.NODE_ENV = undefined;
		process.env.CI = undefined;
		process.env.CI_SAFE_MODE = undefined;

		// Mock fetch
		mockFetch = mock(() => Promise.resolve(new Response("OK", { status: 200 })));
		global.fetch = mockFetch as any;
	});

	afterEach(() => {
		// Restore process.env
		process.env = originalEnv;

		// Restore fetch
		global.fetch = originalFetch;

		// Clear mock
		mockFetch.mockRestore();
	});

	describe("isCI", () => {
		test("skips when CI=true", async () => {
			process.env.CI = "true";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const results = await checker.run();

			expect(results).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test("skips when CI_SAFE_MODE=true", async () => {
			process.env.CI_SAFE_MODE = "true";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const results = await checker.run();

			expect(results).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test("skips when NODE_ENV=test", async () => {
			process.env.NODE_ENV = "test";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const results = await checker.run();

			expect(results).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test("runs when not in CI", async () => {
			// Ensure no CI variables are set
			process.env.CI = undefined;
			process.env.CI_SAFE_MODE = undefined;
			process.env.NODE_ENV = undefined;

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const results = await checker.run();

			expect(results.length).toBe(3); // proxy, github, api
			expect(results.map((r) => r.id)).toEqual([
				"net-proxy-detected",
				"net-github-reachable",
				"net-api-github",
			]);
		});
	});

	describe("checkProxyDetected", () => {
		test("returns info when no proxy configured", async () => {
			process.env.HTTP_PROXY = undefined;
			process.env.http_proxy = undefined;
			process.env.HTTPS_PROXY = undefined;
			process.env.https_proxy = undefined;

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			expect(result.id).toBe("net-proxy-detected");
			expect(result.name).toBe("Proxy");
			expect(result.group).toBe("network");
			expect(result.priority).toBe("standard");
			expect(result.status).toBe("info");
			expect(result.message).toBe("No proxy configured");
			expect(result.autoFixable).toBe(false);
		});

		test("detects HTTP_PROXY", async () => {
			process.env.HTTP_PROXY = "http://proxy.example.com:8080";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			expect(result.status).toBe("warn");
			expect(result.message).toBe("Proxy detected");
			expect(result.details).toBe("HTTP_PROXY=http://proxy.example.com:8080");
			expect(result.suggestion).toBe("Ensure proxy settings allow access to github.com");
		});

		test("detects HTTPS_PROXY", async () => {
			process.env.HTTPS_PROXY = "https://secure-proxy.example.com:3128";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			expect(result.status).toBe("warn");
			expect(result.message).toBe("Proxy detected");
			expect(result.details).toBe("HTTPS_PROXY=https://secure-proxy.example.com:3128");
		});

		test("detects both HTTP_PROXY and HTTPS_PROXY", async () => {
			process.env.HTTP_PROXY = "http://proxy.example.com:8080";
			process.env.HTTPS_PROXY = "https://secure-proxy.example.com:3128";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			expect(result.status).toBe("warn");
			expect(result.details).toBe(
				"HTTP_PROXY=http://proxy.example.com:8080, HTTPS_PROXY=https://secure-proxy.example.com:3128",
			);
		});

		test("includes NO_PROXY in details when present", async () => {
			process.env.HTTP_PROXY = "http://proxy.example.com:8080";
			process.env.NO_PROXY = "localhost,127.0.0.1";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			expect(result.details).toBe(
				"HTTP_PROXY=http://proxy.example.com:8080, NO_PROXY=localhost,127.0.0.1",
			);
		});

		test("handles lowercase proxy variables", async () => {
			process.env.http_proxy = "http://proxy.example.com:8080";
			process.env.https_proxy = "https://secure-proxy.example.com:3128";
			process.env.no_proxy = "localhost";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			expect(result.status).toBe("warn");
			expect(result.details).toBe(
				"HTTP_PROXY=http://proxy.example.com:8080, HTTPS_PROXY=https://secure-proxy.example.com:3128, NO_PROXY=localhost",
			);
		});
	});

	describe("checkGitHubReachable", () => {
		test("returns pass on successful connection (200)", async () => {
			mockFetch.mockResolvedValue(new Response("OK", { status: 200, statusText: "OK" }));

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.id).toBe("net-github-reachable");
			expect(result.name).toBe("GitHub");
			expect(result.group).toBe("network");
			expect(result.priority).toBe("standard");
			expect(result.status).toBe("pass");
			expect(result.message).toMatch(/^Connected \(\d+ms\)$/);
			expect(result.autoFixable).toBe(false);
			expect(mockFetch).toHaveBeenCalledWith(
				"https://github.com",
				expect.objectContaining({
					method: "HEAD",
				}),
			);
			// Verify signal was passed
			const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
			expect(call[1]?.signal).toBeDefined();
		});

		test("returns pass on redirect (301)", async () => {
			mockFetch.mockResolvedValue(
				new Response("Redirect", { status: 301, statusText: "Moved Permanently" }),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.status).toBe("pass");
			expect(result.message).toMatch(/^Connected \(\d+ms\)$/);
		});

		test("returns pass on redirect (302)", async () => {
			mockFetch.mockResolvedValue(new Response("Found", { status: 302, statusText: "Found" }));

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.status).toBe("pass");
		});

		test("returns warn on HTTP error (4xx)", async () => {
			mockFetch.mockResolvedValue(
				new Response("Not Found", { status: 404, statusText: "Not Found" }),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.status).toBe("warn");
			expect(result.message).toBe("HTTP 404");
			expect(result.suggestion).toBe("GitHub returned unexpected status");
		});

		test("returns warn on HTTP error (5xx)", async () => {
			mockFetch.mockResolvedValue(
				new Response("Server Error", { status: 500, statusText: "Internal Server Error" }),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.status).toBe("warn");
			expect(result.message).toBe("HTTP 500");
		});

		test("returns fail on timeout", async () => {
			// Mock AbortController to simulate timeout
			const mockAbortController = {
				signal: new EventTarget(),
				abort: mock(),
			};
			const abortControllerSpy = spyOn(global, "AbortController") as any;
			abortControllerSpy.mockImplementation(() => mockAbortController);

			// Mock fetch to throw AbortError immediately
			const abortError = new Error("Request aborted");
			abortError.name = "AbortError";
			mockFetch.mockRejectedValue(abortError);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Timeout (>3s)");
			expect(result.suggestion).toBe("Check internet connection or proxy settings");
		});

		test("returns fail on connection failure", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Connection failed");
		});

		test("measures latency", async () => {
			mockFetch.mockResolvedValue(new Response("OK", { status: 200 }));

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkGitHubReachable();

			expect(result.status).toBe("pass");
			expect(result.message).toMatch(/^Connected \(\d+ms\)$/);
			// Latency should be a positive number
			const latency = Number.parseInt(result.message.match(/\d+/)?.[0]);
			expect(latency).toBeGreaterThanOrEqual(0);
		});
	});

	describe("checkApiGitHub", () => {
		test("returns pass on successful API response", async () => {
			mockFetch.mockResolvedValue(
				new Response('{"resources": {}}', {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "application/json" },
				}),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkApiGitHub();

			expect(result.id).toBe("net-api-github");
			expect(result.name).toBe("GitHub API");
			expect(result.group).toBe("network");
			expect(result.priority).toBe("standard");
			expect(result.status).toBe("pass");
			expect(result.message).toMatch(/^Connected \(\d+ms\)$/);
			expect(result.autoFixable).toBe(false);
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.github.com/rate_limit",
				expect.objectContaining({
					method: "GET",
					headers: {
						Accept: "application/vnd.github.v3+json",
						"User-Agent": "claudekit-cli",
					},
				}),
			);
			// Verify signal was passed
			const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
			expect(call[1]?.signal).toBeDefined();
		});

		test("returns warn on rate limit (403)", async () => {
			mockFetch.mockResolvedValue(
				new Response("Rate limit exceeded", {
					status: 403,
					statusText: "Forbidden",
				}),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkApiGitHub();

			expect(result.status).toBe("warn");
			expect(result.message).toBe("HTTP 403");
			expect(result.suggestion).toBe("Rate limited - wait or authenticate");
		});

		test("returns warn on other HTTP errors", async () => {
			mockFetch.mockResolvedValue(
				new Response("Unauthorized", {
					status: 401,
					statusText: "Unauthorized",
				}),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkApiGitHub();

			expect(result.status).toBe("warn");
			expect(result.message).toBe("HTTP 401");
			expect(result.suggestion).toBe("API returned unexpected status");
		});

		test("returns fail on timeout", async () => {
			// Mock AbortController to simulate timeout
			const mockAbortController = {
				signal: new EventTarget(),
				abort: mock(),
			};
			const abortControllerSpy = spyOn(global, "AbortController") as any;
			abortControllerSpy.mockImplementation(() => mockAbortController);

			// Mock fetch to throw AbortError immediately
			const abortError = new Error("Request aborted");
			abortError.name = "AbortError";
			mockFetch.mockRejectedValue(abortError);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkApiGitHub();

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Timeout (>3s)");
			expect(result.suggestion).toBe(
				"Check internet connection or proxy settings for api.github.com",
			);
		});

		test("returns fail on connection failure", async () => {
			mockFetch.mockRejectedValue(new Error("DNS resolution failed"));

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkApiGitHub();

			expect(result.status).toBe("fail");
			expect(result.message).toBe("Connection failed");
			expect(result.suggestion).toBe(
				"Check internet connection or proxy settings for api.github.com",
			);
		});
	});

	describe("run", () => {
		test("executes all checks when not in CI", async () => {
			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			// Mock successful responses
			mockFetch
				.mockResolvedValueOnce(new Response("OK", { status: 200 }))
				.mockResolvedValueOnce(new Response('{"resources": {}}', { status: 200 }));

			const results = await checker.run();

			expect(results).toHaveLength(3);
			expect(results.map((r) => r.id)).toEqual([
				"net-proxy-detected",
				"net-github-reachable",
				"net-api-github",
			]);

			// Verify all checks have correct structure
			for (const result of results) {
				expect(result).toHaveProperty("id");
				expect(result).toHaveProperty("name");
				expect(result).toHaveProperty("group", "network");
				expect(result).toHaveProperty("priority", "standard");
				expect(result).toHaveProperty("status");
				expect(result).toHaveProperty("message");
				expect(result).toHaveProperty("autoFixable", false);
			}

			// Should have made 2 fetch calls (not including proxy check)
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		test("returns empty array in CI mode", async () => {
			process.env.CI = "true";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const results = await checker.run();

			expect(results).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test("handles network errors gracefully", async () => {
			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			// Mock network failures
			mockFetch
				.mockRejectedValueOnce(new Error("Network error"))
				.mockRejectedValueOnce(new Error("API unreachable"));

			const results = await checker.run();

			expect(results).toHaveLength(3);

			// Proxy check should still succeed
			expect(results[0].id).toBe("net-proxy-detected");
			expect(results[0].status).toBe("info");

			// Network checks should fail gracefully
			expect(results[1].id).toBe("net-github-reachable");
			expect(results[1].status).toBe("fail");
			expect(results[1].message).toBe("Connection failed");

			expect(results[2].id).toBe("net-api-github");
			expect(results[2].status).toBe("fail");
			expect(results[2].message).toBe("Connection failed");
		});
	});

	describe("Edge cases", () => {
		test("handles empty proxy environment variables", async () => {
			process.env.HTTP_PROXY = "";
			process.env.HTTPS_PROXY = "   ";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			// Empty strings are falsy in this context, only non-empty strings count
			expect(result.status).toBe("warn");
			expect(result.message).toBe("Proxy detected");
			expect(result.details).toBe("HTTPS_PROXY=   ");
		});

		test("handles malformed proxy URLs", async () => {
			process.env.HTTP_PROXY = "not-a-url";
			process.env.HTTPS_PROXY = "http://[invalid-ipv6";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			// Should still detect proxy even if malformed
			expect(result.status).toBe("warn");
			expect(result.details).toBe("HTTP_PROXY=not-a-url, HTTPS_PROXY=http://[invalid-ipv6");
		});

		test("handles different response content types", async () => {
			mockFetch.mockResolvedValue(
				new Response("Plain text", {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "text/plain" },
				}),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkApiGitHub();

			// Should still be successful regardless of content type
			expect(result.status).toBe("pass");
			expect(result.message).toMatch(/^Connected \(\d+ms\)$/);
		});

		test("handles malformed proxy URLs", async () => {
			process.env.HTTP_PROXY = "not-a-url";
			process.env.HTTPS_PROXY = "http://[invalid-ipv6";

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkProxyDetected();

			// Should still detect proxy even if malformed
			expect(result.status).toBe("warn");
			expect(result.details).toBe("HTTP_PROXY=not-a-url, HTTPS_PROXY=http://[invalid-ipv6");
		});

		test("handles different response content types", async () => {
			mockFetch.mockResolvedValue(
				new Response("Plain text", {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "text/plain" },
				}),
			);

			const { NetworkChecker } = await import("../../../src/lib/health-checks/network-checker.js");
			const checker = new NetworkChecker();

			const result = await (checker as any).checkApiGitHub();

			// Should still be successful regardless of content type
			expect(result.status).toBe("pass");
			expect(result.message).toMatch(/^Connected \(\d+ms\)$/);
		});
	});
});
