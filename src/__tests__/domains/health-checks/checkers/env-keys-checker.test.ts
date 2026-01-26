import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEnvKeys } from "@/domains/health-checks/checkers/env-keys-checker.js";
import type { ClaudeKitSetup } from "@/types";

describe("checkEnvKeys", () => {
	let tempDir: string;
	let globalDir: string;
	let projectDir: string;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`env-keys-checker-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		globalDir = join(tempDir, "global");
		projectDir = join(tempDir, "project");
		await mkdir(globalDir, { recursive: true });
		await mkdir(projectDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	function createSetup(options: {
		hasGlobal?: boolean;
		hasProjectMetadata?: boolean;
	}): ClaudeKitSetup {
		return {
			global: {
				path: options.hasGlobal ? globalDir : null,
				components: { agents: 0, commands: 0, rules: 0, skills: 0 },
			},
			project: {
				path: projectDir,
				metadata: options.hasProjectMetadata ? { version: "1.0.0", kit: "engineer" } : null,
				components: { agents: 0, commands: 0, rules: 0, skills: 0 },
			},
		} as ClaudeKitSetup;
	}

	test("returns empty array when no global path and no project metadata", async () => {
		const setup = createSetup({ hasGlobal: false, hasProjectMetadata: false });
		const results = await checkEnvKeys(setup);

		expect(results).toEqual([]);
	});

	test("returns warn status when global .env is missing", async () => {
		const setup = createSetup({ hasGlobal: true, hasProjectMetadata: false });
		const results = await checkEnvKeys(setup);

		expect(results.length).toBe(1);
		expect(results[0].id).toBe("ck-global-env-keys");
		expect(results[0].status).toBe("warn");
		expect(results[0].message).toBe(".env file not found");
		expect(results[0].suggestion).toBe("Run: ck init --global");
	});

	test("returns warn status when global .env missing required key", async () => {
		await writeFile(join(globalDir, ".env"), "OTHER_KEY=value");
		const setup = createSetup({ hasGlobal: true, hasProjectMetadata: false });
		const results = await checkEnvKeys(setup);

		expect(results.length).toBe(1);
		expect(results[0].status).toBe("warn");
		expect(results[0].message).toBe("Missing: Gemini API Key");
	});

	test("returns pass status when global .env has required key", async () => {
		await writeFile(join(globalDir, ".env"), "GEMINI_API_KEY=AIzaSyTestKey12345678901234567890123");
		const setup = createSetup({ hasGlobal: true, hasProjectMetadata: false });
		const results = await checkEnvKeys(setup);

		expect(results.length).toBe(1);
		expect(results[0].status).toBe("pass");
		expect(results[0].message).toBe("1 required key(s) configured");
	});

	test("returns warn status when project .env is missing", async () => {
		const setup = createSetup({ hasGlobal: false, hasProjectMetadata: true });
		const results = await checkEnvKeys(setup);

		expect(results.length).toBe(1);
		expect(results[0].id).toBe("ck-project-env-keys");
		expect(results[0].status).toBe("warn");
		expect(results[0].message).toBe(".env file not found");
		expect(results[0].suggestion).toBe("Run: ck init");
	});

	test("returns pass status when project .env has required key", async () => {
		await writeFile(
			join(projectDir, ".env"),
			"GEMINI_API_KEY=AIzaSyTestKey12345678901234567890123",
		);
		const setup = createSetup({ hasGlobal: false, hasProjectMetadata: true });
		const results = await checkEnvKeys(setup);

		expect(results.length).toBe(1);
		expect(results[0].status).toBe("pass");
	});

	test("checks both global and project when both exist", async () => {
		await writeFile(join(globalDir, ".env"), "GEMINI_API_KEY=AIzaSyTestKey12345678901234567890123");
		await writeFile(join(projectDir, ".env"), "OTHER_KEY=value");
		const setup = createSetup({ hasGlobal: true, hasProjectMetadata: true });
		const results = await checkEnvKeys(setup);

		expect(results.length).toBe(2);
		expect(results[0].id).toBe("ck-global-env-keys");
		expect(results[0].status).toBe("pass");
		expect(results[1].id).toBe("ck-project-env-keys");
		expect(results[1].status).toBe("warn");
	});
});
