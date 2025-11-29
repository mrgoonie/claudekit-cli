import { describe, expect, test } from "bun:test";
import { VALIDATION_PATTERNS, validateApiKey } from "../../src/lib/config-validator.js";

describe("config-validator", () => {
	describe("GEMINI_API_KEY validation", () => {
		test("should accept valid Gemini API key", () => {
			const validKey = "AIzaSyA_FAKE_TEST_KEY_12345678901234567";
			expect(validateApiKey(validKey, VALIDATION_PATTERNS.GEMINI_API_KEY)).toBe(true);
		});

		test("should reject invalid Gemini API key", () => {
			expect(validateApiKey("invalid", VALIDATION_PATTERNS.GEMINI_API_KEY)).toBe(false);
			expect(validateApiKey("", VALIDATION_PATTERNS.GEMINI_API_KEY)).toBe(false);
		});
	});

	describe("DISCORD_WEBHOOK_URL validation", () => {
		test("should accept valid Discord webhook", () => {
			const validUrl = "https://discord.com/api/webhooks/123/abc";
			expect(validateApiKey(validUrl, VALIDATION_PATTERNS.DISCORD_WEBHOOK_URL)).toBe(true);
		});

		test("should reject invalid Discord webhook", () => {
			expect(
				validateApiKey("https://slack.com/webhook", VALIDATION_PATTERNS.DISCORD_WEBHOOK_URL),
			).toBe(false);
		});
	});

	describe("TELEGRAM_BOT_TOKEN validation", () => {
		test("should accept valid Telegram token", () => {
			const validToken = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789";
			expect(validateApiKey(validToken, VALIDATION_PATTERNS.TELEGRAM_BOT_TOKEN)).toBe(true);
		});

		test("should reject invalid Telegram tokens", () => {
			// Missing colon separator
			expect(validateApiKey("123456789ABCdefGHI", VALIDATION_PATTERNS.TELEGRAM_BOT_TOKEN)).toBe(
				false,
			);
			// Non-numeric bot ID
			expect(
				validateApiKey(
					"abc:ABCdefGHIjklMNOpqrsTUVwxyz123456789",
					VALIDATION_PATTERNS.TELEGRAM_BOT_TOKEN,
				),
			).toBe(false);
			// Token part too short
			expect(validateApiKey("123456789:ABC", VALIDATION_PATTERNS.TELEGRAM_BOT_TOKEN)).toBe(false);
			// Empty string
			expect(validateApiKey("", VALIDATION_PATTERNS.TELEGRAM_BOT_TOKEN)).toBe(false);
			// Invalid characters in token
			expect(
				validateApiKey("123456789:ABC!@#$%^&*()+=", VALIDATION_PATTERNS.TELEGRAM_BOT_TOKEN),
			).toBe(false);
		});
	});
});
