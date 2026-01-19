import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUIRED_ENV_KEYS, checkRequiredKeysExist } from "@/domains/installation/setup-wizard.js";

describe("checkRequiredKeysExist", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`setup-wizard-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns envExists: false when .env does not exist", async () => {
		const envPath = join(tempDir, ".env");
		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(false);
		expect(result.allPresent).toBe(false);
		expect(result.missing).toEqual(REQUIRED_ENV_KEYS);
	});

	test("returns missing keys when .env is empty", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, "");

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(false);
		expect(result.missing).toEqual(REQUIRED_ENV_KEYS);
	});

	test("returns missing keys when .env has only comments", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, "# This is a comment\n# Another comment\n");

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(false);
		expect(result.missing).toEqual(REQUIRED_ENV_KEYS);
	});

	test("returns allPresent: true when GEMINI_API_KEY exists", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, "GEMINI_API_KEY=AIzaSyTestKey12345678901234567890123");

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("handles quoted values correctly", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, 'GEMINI_API_KEY="AIzaSyTestKey12345678901234567890123"');

		const result = await checkRequiredKeysExist(envPath);

		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("handles single-quoted values correctly", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, "GEMINI_API_KEY='AIzaSyTestKey12345678901234567890123'");

		const result = await checkRequiredKeysExist(envPath);

		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("handles export prefix correctly", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, "export GEMINI_API_KEY=AIzaSyTestKey12345678901234567890123");

		const result = await checkRequiredKeysExist(envPath);

		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("treats whitespace-only value as missing", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, "GEMINI_API_KEY=   ");

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(false);
		expect(result.missing).toEqual(REQUIRED_ENV_KEYS);
	});

	test("treats whitespace-only quoted value as missing", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, 'GEMINI_API_KEY="   "');

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(false);
		expect(result.missing).toEqual(REQUIRED_ENV_KEYS);
	});

	test("treats empty quoted value as missing", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, 'GEMINI_API_KEY=""');

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(false);
		expect(result.missing).toEqual(REQUIRED_ENV_KEYS);
	});

	test("handles multiple env vars with key present", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(
			envPath,
			[
				"# Config file",
				"OTHER_KEY=value",
				"GEMINI_API_KEY=AIzaSyTestKey12345678901234567890123",
				"DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123",
			].join("\n"),
		);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("handles multiple env vars with key missing", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(
			envPath,
			["# Config file", "OTHER_KEY=value", "DISCORD_WEBHOOK_URL=https://discord.com"].join("\n"),
		);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(false);
		expect(result.missing.length).toBe(1);
		expect(result.missing[0].key).toBe("GEMINI_API_KEY");
	});
});
