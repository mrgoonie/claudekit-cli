import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	REQUIRED_ENV_KEYS,
	checkRequiredKeysExist,
	getConfiguredImageProviders,
	getDefaultImageProviderSelection,
} from "@/domains/installation/setup-wizard.js";

const VALID_GEMINI_KEY = `AIza${"A".repeat(35)}`;
const VALID_OPENROUTER_KEY = "sk-or-v1-abcdefghijklmnopqrstuvwxyz123456";
const VALID_MINIMAX_KEY = "minimax_test_key_1234567890";

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
		await writeFile(envPath, `GEMINI_API_KEY=${VALID_GEMINI_KEY}`);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("returns allPresent: true when OPENROUTER_API_KEY exists", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, `OPENROUTER_API_KEY=${VALID_OPENROUTER_KEY}`);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
		expect(result.configuredProviders).toEqual(["openrouter"]);
	});

	test("returns allPresent: true when MINIMAX_API_KEY exists", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, `MINIMAX_API_KEY=${VALID_MINIMAX_KEY}`);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
		expect(result.configuredProviders).toEqual(["minimax"]);
	});

	test("treats invalid provider keys as missing", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, "GEMINI_API_KEY=invalid");

		const result = await checkRequiredKeysExist(envPath);

		expect(result.envExists).toBe(true);
		expect(result.allPresent).toBe(false);
		expect(result.missing).toEqual(REQUIRED_ENV_KEYS);
		expect(result.configuredProviders).toEqual([]);
	});

	test("handles quoted values correctly", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, `GEMINI_API_KEY="${VALID_GEMINI_KEY}"`);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("handles single-quoted values correctly", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, `GEMINI_API_KEY='${VALID_GEMINI_KEY}'`);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
	});

	test("handles export prefix correctly", async () => {
		const envPath = join(tempDir, ".env");
		await writeFile(envPath, `export GEMINI_API_KEY=${VALID_GEMINI_KEY}`);

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
				`GEMINI_API_KEY=${VALID_GEMINI_KEY}`,
				"DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123",
			].join("\n"),
		);

		const result = await checkRequiredKeysExist(envPath);

		expect(result.allPresent).toBe(true);
		expect(result.missing).toEqual([]);
		expect(result.configuredProviders).toEqual(["google"]);
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
		expect(result.missing[0].key).toBe("IMAGE_PROVIDER_API_KEY");
	});
});

describe("image provider helpers", () => {
	test("getConfiguredImageProviders returns all configured provider paths", () => {
		expect(
			getConfiguredImageProviders({
				GEMINI_API_KEY: VALID_GEMINI_KEY,
				OPENROUTER_API_KEY: VALID_OPENROUTER_KEY,
				MINIMAX_API_KEY: "",
			}),
		).toEqual(["google", "openrouter"]);
	});

	test("getConfiguredImageProviders ignores invalid provider values", () => {
		expect(
			getConfiguredImageProviders({
				GEMINI_API_KEY: "invalid",
				OPENROUTER_API_KEY: VALID_OPENROUTER_KEY,
				MINIMAX_API_KEY: "short",
			}),
		).toEqual(["openrouter"]);
	});

	test("getDefaultImageProviderSelection prefers existing supported choice", () => {
		expect(getDefaultImageProviderSelection(["google", "openrouter"], "openrouter")).toBe(
			"openrouter",
		);
	});

	test("getDefaultImageProviderSelection preserves explicit auto preference", () => {
		expect(getDefaultImageProviderSelection(["google", "openrouter"], "auto")).toBe("auto");
	});

	test("getDefaultImageProviderSelection does not preserve auto without Gemini", () => {
		expect(getDefaultImageProviderSelection(["openrouter", "minimax"], "auto")).toBe("openrouter");
	});

	test("getDefaultImageProviderSelection ignores stale auto when Gemini key is invalid", () => {
		const configuredProviders = getConfiguredImageProviders({
			GEMINI_API_KEY: "invalid",
			OPENROUTER_API_KEY: VALID_OPENROUTER_KEY,
		});

		expect(getDefaultImageProviderSelection(configuredProviders, "auto")).toBe("openrouter");
	});

	test("getDefaultImageProviderSelection falls back to auto when Gemini is configured", () => {
		expect(getDefaultImageProviderSelection(["google", "openrouter"])).toBe("auto");
	});

	test("getDefaultImageProviderSelection falls back to first configured non-Google provider", () => {
		expect(getDefaultImageProviderSelection(["openrouter", "minimax"])).toBe("openrouter");
	});

	test("getDefaultImageProviderSelection ignores unsupported existing preference", () => {
		expect(getDefaultImageProviderSelection(["minimax"], "openrouter")).toBe("minimax");
	});
});
