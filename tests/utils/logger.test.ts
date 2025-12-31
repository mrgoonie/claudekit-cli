import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { logger } from "@/shared/logger.js";

describe("Logger Utilities", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	const originalDebug = process.env.DEBUG;

	beforeEach(() => {
		// Reset logger state
		logger.setVerbose(false);
		logger.setLogFile(undefined);

		// Use spyOn instead of mock() to avoid global pollution
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		process.env.DEBUG = originalDebug;
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	describe("info", () => {
		test("should log info messages", () => {
			logger.info("Test info message");
			expect(consoleLogSpy).toHaveBeenCalled();
		});
	});

	describe("success", () => {
		test("should log success messages", () => {
			logger.success("Test success message");
			expect(consoleLogSpy).toHaveBeenCalled();
		});
	});

	describe("warning", () => {
		test("should log warning messages", () => {
			logger.warning("Test warning message");
			expect(consoleLogSpy).toHaveBeenCalled();
		});
	});

	describe("error", () => {
		test("should log error messages", () => {
			logger.error("Test error message");
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});

	describe("debug", () => {
		test("should log debug messages when DEBUG is set", () => {
			// Clear any previous calls before setting DEBUG
			consoleLogSpy.mockClear();
			process.env.DEBUG = "true";
			logger.debug("Test debug message");
			expect(consoleLogSpy).toHaveBeenCalled();
		});

		test("should not log debug messages when DEBUG is not set", () => {
			// Explicitly clear DEBUG env var before test
			const previousDebug = process.env.DEBUG;
			// biome-ignore lint/performance/noDelete: Required for proper environment variable cleanup in tests
			delete process.env.DEBUG;
			// Reset console log spy to clear any previous calls
			consoleLogSpy.mockClear();
			logger.debug("Test debug message");
			expect(consoleLogSpy).not.toHaveBeenCalled();
			// Restore previous value if it existed
			if (previousDebug !== undefined) {
				process.env.DEBUG = previousDebug;
			}
		});
	});

	describe("sanitize", () => {
		test("should sanitize ghp_ tokens (36 chars)", () => {
			const text = "Token: ghp_123456789012345678901234567890123456";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Token: ghp_***");
		});

		test("should sanitize github_pat_ tokens (82 chars)", () => {
			// github_pat_ prefix + 82 alphanumeric/underscore characters (exact length)
			const token =
				"1234567890123456789012345678901234567890123456789012345678901234567890123456789012";
			const text = `Token: github_pat_${token}`;
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Token: github_pat_***");
		});

		test("should sanitize gho_ tokens (36 chars)", () => {
			const text = "Token: gho_123456789012345678901234567890123456";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Token: gho_***");
		});

		test("should sanitize ghu_ tokens (36 chars)", () => {
			const text = "Token: ghu_123456789012345678901234567890123456";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Token: ghu_***");
		});

		test("should sanitize ghs_ tokens (36 chars)", () => {
			const text = "Token: ghs_123456789012345678901234567890123456";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Token: ghs_***");
		});

		test("should sanitize ghr_ tokens (36 chars)", () => {
			const text = "Token: ghr_123456789012345678901234567890123456";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Token: ghr_***");
		});

		test("should sanitize Bearer tokens", () => {
			const text = "Authorization: Bearer abc123xyz-token_value";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Authorization: Bearer ***");
		});

		test("should sanitize query string tokens", () => {
			const text = "https://api.example.com?token=secret123";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("https://api.example.com?token=***");
		});

		test("should sanitize multiple tokens", () => {
			const ghpToken = "123456789012345678901234567890123456";
			const patToken =
				"1234567890123456789012345678901234567890123456789012345678901234567890123456789012";
			const text = `Tokens: ghp_${ghpToken} and github_pat_${patToken}`;
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe("Tokens: ghp_*** and github_pat_***");
		});

		test("should not modify text without tokens", () => {
			const text = "No tokens here, just regular text";
			const sanitized = logger.sanitize(text);
			expect(sanitized).toBe(text);
		});

		test("should handle empty string", () => {
			const sanitized = logger.sanitize("");
			expect(sanitized).toBe("");
		});
	});

	describe("verbose", () => {
		beforeEach(() => {
			logger.setVerbose(false);
		});

		test("should not log when verbose is disabled", () => {
			logger.verbose("Test verbose message");
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		test("should log to stderr when verbose is enabled", () => {
			logger.setVerbose(true);
			logger.verbose("Test verbose message");
			expect(consoleErrorSpy).toHaveBeenCalled();
			const call = consoleErrorSpy.mock.calls[1][0];
			expect(call).toContain("[VERBOSE]");
			expect(call).toContain("Test verbose message");
		});

		test("should include timestamp in verbose logs", () => {
			logger.setVerbose(true);
			logger.verbose("Test message");
			const call = consoleErrorSpy.mock.calls[1][0];
			expect(call).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		test("should sanitize sensitive data in verbose logs", () => {
			logger.setVerbose(true);
			logger.verbose("Token: ghp_123456789012345678901234567890123456");
			const call = consoleErrorSpy.mock.calls[1][0];
			expect(call).toContain("ghp_***");
			expect(call).not.toContain("ghp_123456789012345678901234567890123456");
		});

		test("should include context in verbose logs", () => {
			logger.setVerbose(true);
			logger.verbose("Test message", { key: "value", num: 123 });
			const call = consoleErrorSpy.mock.calls[1][0];
			expect(call).toContain('"key": "value"');
			expect(call).toContain('"num": 123');
		});

		test("should sanitize context strings", () => {
			logger.setVerbose(true);
			logger.verbose("Test message", {
				token: "ghp_123456789012345678901234567890123456",
			});
			const call = consoleErrorSpy.mock.calls[1][0];
			expect(call).toContain("ghp_***");
			expect(call).not.toContain("ghp_123456789012345678901234567890123456");
		});

		test("should handle nested objects in context", () => {
			logger.setVerbose(true);
			logger.verbose("Test message", {
				nested: { key: "value" },
			});
			const call = consoleErrorSpy.mock.calls[1][0];
			expect(call).toContain('"nested"');
		});
	});

	describe("setVerbose", () => {
		test("should enable verbose logging", () => {
			logger.setVerbose(true);
			expect(logger.isVerbose()).toBe(true);
		});

		test("should disable verbose logging", () => {
			logger.setVerbose(true);
			logger.setVerbose(false);
			expect(logger.isVerbose()).toBe(false);
		});

		test("should log when enabling verbose", () => {
			logger.setVerbose(true);
			expect(consoleErrorSpy).toHaveBeenCalled();
			const call = consoleErrorSpy.mock.calls[0][0];
			expect(call).toContain("Verbose logging enabled");
		});
	});

	describe("isVerbose", () => {
		test("should return false by default", () => {
			expect(logger.isVerbose()).toBe(false);
		});

		test("should return true when enabled", () => {
			logger.setVerbose(true);
			expect(logger.isVerbose()).toBe(true);
		});

		test("should return false when disabled", () => {
			logger.setVerbose(true);
			logger.setVerbose(false);
			expect(logger.isVerbose()).toBe(false);
		});
	});
});
