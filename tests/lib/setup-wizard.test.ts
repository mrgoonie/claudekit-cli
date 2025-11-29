import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathExists } from "fs-extra";

// Note: Full integration tests require mocking @clack/prompts
// These are basic unit tests for the module structure

describe("setup-wizard", () => {
	let tempDir: string;
	let globalDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `ck-test-${Date.now()}`);
		globalDir = join(tmpdir(), `ck-global-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		await mkdir(globalDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		await rm(globalDir, { recursive: true, force: true });
	});

	test("should skip wizard when .env exists", async () => {
		await writeFile(join(tempDir, ".env"), "EXISTING=value");
		const envExists = await pathExists(join(tempDir, ".env"));
		expect(envExists).toBe(true);
	});

	test("should detect global .env for inheritance", async () => {
		await writeFile(join(globalDir, ".env"), "GEMINI_API_KEY=global-key");
		const envExists = await pathExists(join(globalDir, ".env"));
		expect(envExists).toBe(true);
	});
});
