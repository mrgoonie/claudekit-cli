/**
 * Comprehensive edge case tests for GitHub error classifier
 * Tests all 6 edge cases identified in code review
 */

import { describe, expect, test } from "bun:test";
import { classifyGitHubError } from "@/domains/error/error-classifier.js";

describe("classifyGitHubError - Edge Case Coverage", () => {
	describe("Edge Case 1: Negative Reset Time", () => {
		test("should handle past rate limit reset timestamp", () => {
			// Timestamp 60 seconds in the past
			const pastTimestamp = Math.floor((Date.now() - 60000) / 1000).toString();

			const error = {
				status: 403,
				message: "API rate limit exceeded",
				response: {
					headers: {
						"x-ratelimit-reset": pastTimestamp,
					},
				},
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("RATE_LIMIT");
			// Should not display negative numbers in message
			expect(result.details).not.toMatch(/-\d+/);
			expect(result.details).toBeDefined();
		});

		test("should handle zero/current rate limit reset timestamp", () => {
			const currentTimestamp = Math.floor(Date.now() / 1000).toString();

			const error = {
				status: 403,
				message: "API rate limit exceeded",
				response: {
					headers: {
						"x-ratelimit-reset": currentTimestamp,
					},
				},
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("RATE_LIMIT");
			expect(result.details).toBeDefined();
		});
	});

	describe("Edge Case 2: Empty Error Message", () => {
		test("should handle undefined error.message gracefully", () => {
			const error = { status: 500 };

			expect(() => classifyGitHubError(error)).not.toThrow();

			const result = classifyGitHubError(error);
			expect(result.category).toBe("UNKNOWN");
			expect(result.message).toBeDefined();
		});

		test("should handle empty string error.message", () => {
			const error = { status: 500, message: "" };

			expect(() => classifyGitHubError(error)).not.toThrow();

			const result = classifyGitHubError(error);
			expect(result.category).toBe("UNKNOWN");
		});

		test("should handle null error.message", () => {
			// Using 'as any' because we're testing edge case with malformed input
			const error = { status: 500, message: null } as any;

			expect(() => classifyGitHubError(error)).not.toThrow();

			const result = classifyGitHubError(error);
			expect(result.category).toBe("UNKNOWN");
		});

		test("should default to operation name in message when error.message is empty", () => {
			const error = { status: 500, message: "" };

			const result = classifyGitHubError(error, "download repository");

			expect(result.message).toContain("download repository");
		});
	});

	describe("Edge Case 3: NaN from parseInt", () => {
		test("should handle non-numeric x-ratelimit-reset header", () => {
			const error = {
				status: 403,
				message: "API rate limit exceeded",
				response: {
					headers: {
						"x-ratelimit-reset": "not-a-number",
					},
				},
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("RATE_LIMIT");
			// Ensure "NaN" doesn't appear in output
			expect(result.details).not.toContain("NaN");
			expect(result.details).toBeDefined();
		});

		test("should handle x-ratelimit-reset with special characters", () => {
			const error = {
				status: 403,
				message: "API rate limit exceeded",
				response: {
					headers: {
						"x-ratelimit-reset": "2025-01-19T12:00:00Z", // ISO date, not unix timestamp
					},
				},
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("RATE_LIMIT");
			expect(result.details).not.toContain("NaN");
		});

		test("should handle missing x-ratelimit-reset header", () => {
			const error = {
				status: 403,
				message: "API rate limit exceeded",
				response: {
					headers: {},
				},
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("RATE_LIMIT");
			expect(result.details).toContain("will reset soon");
		});
	});

	describe("Edge Case 4: 403 Misclassification", () => {
		test("should correctly classify generic 403 as AUTH_SCOPE", () => {
			const error = {
				status: 403,
				message: "Forbidden",
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("AUTH_SCOPE");
		});

		test("should NOT classify rate limit 403 as AUTH_SCOPE", () => {
			const error = {
				status: 403,
				message: "API rate limit exceeded",
			};

			const result = classifyGitHubError(error);

			expect(result.category).not.toBe("AUTH_SCOPE");
			expect(result.category).toBe("RATE_LIMIT");
		});

		// These tests document current behavior but identify needed improvements:
		test("[KNOWN ISSUE] misclassifies SSO error as AUTH_SCOPE", () => {
			const error = {
				status: 403,
				message:
					"Insufficient permissions due to SAML SSO requirement. Please complete SAML login.",
			};

			const result = classifyGitHubError(error);

			// Current behavior (incorrect):
			expect(result.category).toBe("AUTH_SCOPE");

			// TODO: Should differentiate SSO errors
			// Expected: New category like "SSO_REQUIRED" or "SAML_REQUIRED"
		});

		test("[KNOWN ISSUE] misclassifies org policy restriction as AUTH_SCOPE", () => {
			const error = {
				status: 403,
				message:
					"Resource not accessible through API. This repository may have organization restrictions.",
			};

			const result = classifyGitHubError(error);

			// Current behavior (documented limitation):
			expect(result.category).toBe("AUTH_SCOPE");
			// Note: Future improvement could add "REPO_ACCESS" or "ORG_POLICY" category
		});

		test("[KNOWN ISSUE] misclassifies suspended account as AUTH_SCOPE", () => {
			const error = {
				status: 403,
				message: "API access suspended due to account suspension",
			};

			const result = classifyGitHubError(error);

			// Current behavior (incorrect):
			expect(result.category).toBe("AUTH_SCOPE");

			// TODO: Should be "UNKNOWN" with better details or new "ACCOUNT_SUSPENDED" category
		});
	});

	describe("Edge Case 5: Case Sensitivity in Network Errors", () => {
		test("should handle uppercase network error codes", () => {
			const error = {
				message: "Error: ECONNREFUSED connection refused to api.github.com",
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("NETWORK");
		});

		test("should handle mixed case network error codes", () => {
			const error = {
				message: "Error: EConnRefused at api.github.com",
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("NETWORK");
		});

		test("should handle various network error types", () => {
			const errorCodes = [
				{ message: "ETIMEDOUT: connection timed out" },
				{ message: "ENOTFOUND: getaddrinfo ENOTFOUND github.com" },
				{ message: "Network error: connection reset" },
			];

			for (const error of errorCodes) {
				const result = classifyGitHubError(error);
				expect(result.category).toBe("NETWORK");
			}
		});
	});

	describe("Edge Case 6: SSH Error Variants", () => {
		test("should catch basic SSH errors", () => {
			const error = {
				message: "SSH error: permission denied (publickey)",
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("SSH_KEY");
		});

		test("should handle host key verification failure", () => {
			const error = {
				message: "Host key verification failed",
			};

			const result = classifyGitHubError(error);

			// Fixed: Now correctly detects SSH key issues
			expect(result.category).toBe("SSH_KEY");
		});

		test("[MISSING PATTERN] SSH agent connection failure", () => {
			const error = {
				message: "Could not open a connection to SSH agent",
			};

			const result = classifyGitHubError(error);

			// Current: Falls through to UNKNOWN
			expect(result.category).toBe("UNKNOWN");

			// TODO: Should be SSH_KEY
		});

		test("[MISSING PATTERN] known_hosts verification issue", () => {
			const error = {
				message: "Offending RSA key in /home/user/.ssh/known_hosts:42",
			};

			const result = classifyGitHubError(error);

			// Current: Falls through to UNKNOWN
			expect(result.category).toBe("UNKNOWN");

			// TODO: Should be SSH_KEY
		});

		test("[MISSING PATTERN] unprotected private key", () => {
			const error = {
				message:
					"Permissions 0644 for '/home/user/.ssh/id_rsa' are too open. UNPROTECTED PRIVATE KEY FILE",
			};

			const result = classifyGitHubError(error);

			// Current: Falls through to UNKNOWN
			expect(result.category).toBe("UNKNOWN");

			// TODO: Should be SSH_KEY
		});

		test("[MISSING PATTERN] SSH authentication failures exceeded", () => {
			const error = {
				message: "SSH_MSG_DISCONNECT: Too many authentication failures for git",
			};

			const result = classifyGitHubError(error);

			// Current: Falls through to UNKNOWN
			expect(result.category).toBe("UNKNOWN");

			// TODO: Should be SSH_KEY
		});

		test("[MISSING PATTERN] no identities available", () => {
			const error = {
				message: "No identities found in SSH agent",
			};

			const result = classifyGitHubError(error);

			// Current: Falls through to UNKNOWN
			expect(result.category).toBe("UNKNOWN");

			// TODO: Should be SSH_KEY
		});
	});

	describe("Combined Edge Cases", () => {
		test("should handle error with undefined status, message, and response", () => {
			const error = {};

			expect(() => classifyGitHubError(error)).not.toThrow();

			const result = classifyGitHubError(error);
			expect(result.category).toBe("UNKNOWN");
		});

		test("should handle deeply nested response structures", () => {
			// Using 'as any' because we're testing edge case with malformed input (null header value)
			const error = {
				status: 403,
				message: "Forbidden",
				response: {
					headers: {
						"x-ratelimit-reset": null,
					},
					data: {
						message: "Some nested error",
					},
				},
			} as any;

			expect(() => classifyGitHubError(error)).not.toThrow();

			const result = classifyGitHubError(error);
			expect(result.category).toBe("AUTH_SCOPE");
		});

		test("should handle error with operation parameter", () => {
			const error = { message: "" };

			const result = classifyGitHubError(error, "clone repository");

			expect(result.message).toContain("clone repository");
		});
	});

	describe("Happy Path - Ensure fixes don't break working cases", () => {
		test("should classify 401 as AUTH_MISSING", () => {
			const error = { status: 401, message: "Unauthorized" };
			const result = classifyGitHubError(error);
			expect(result.category).toBe("AUTH_MISSING");
		});

		test("should classify 404 as REPO_NOT_FOUND", () => {
			const error = { status: 404, message: "Not Found" };
			const result = classifyGitHubError(error);
			expect(result.category).toBe("REPO_NOT_FOUND");
		});

		test("should classify rate limit with valid timestamp", () => {
			const futureTimestamp = Math.floor((Date.now() + 3600000) / 1000).toString();
			const error = {
				status: 403,
				message: "API rate limit exceeded",
				response: {
					headers: {
						"x-ratelimit-reset": futureTimestamp,
					},
				},
			};

			const result = classifyGitHubError(error);

			expect(result.category).toBe("RATE_LIMIT");
			expect(result.details).toContain("minutes");
			expect(result.details).not.toContain("NaN");
		});
	});
});
