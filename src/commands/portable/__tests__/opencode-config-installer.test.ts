import { afterEach, beforeEach, describe, expect, it } from "bun:test";
/**
 * Tests for opencode-config-installer — regression coverage for #728.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OPENCODE_DEFAULT_MODEL, setTaxonomyOverrides } from "../model-taxonomy.js";
import { ensureOpenCodeModel, suggestOpenCodeDefaultModel } from "../opencode-config-installer.js";

describe("ensureOpenCodeModel (project scope)", () => {
	let tempDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-opencode-"));
		originalCwd = process.cwd();
		process.chdir(tempDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		setTaxonomyOverrides(undefined);
		await rm(tempDir, { recursive: true, force: true });
	});

	it("creates opencode.json with default model when file missing", async () => {
		const result = await ensureOpenCodeModel({ global: false });

		expect(result.action).toBe("created");
		expect(result.model).toBe(OPENCODE_DEFAULT_MODEL);

		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
	});

	it("adds model to existing opencode.json while preserving other fields", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ mcp: { pencil: { command: ["foo"] } } }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({ global: false });

		expect(result.action).toBe("added");
		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
		expect(contents.mcp).toEqual({ pencil: { command: ["foo"] } });
	});

	it("leaves existing model field untouched", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ model: "anthropic/claude-opus-4-5" }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({ global: false });

		expect(result.action).toBe("existing");
		expect(result.model).toBe("anthropic/claude-opus-4-5");
	});

	it("recreates config when existing file is malformed JSON", async () => {
		await writeFile(join(tempDir, "opencode.json"), "{ not json", "utf-8");

		const result = await ensureOpenCodeModel({ global: false });

		expect(result.action).toBe("created");
		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
	});

	it("honors .ck.json taxonomy override for opencode default model", async () => {
		setTaxonomyOverrides({
			opencode: { default: { model: "anthropic/claude-opus-4-5" } },
		});

		const result = await ensureOpenCodeModel({ global: false });

		expect(result.model).toBe("anthropic/claude-opus-4-5");
	});

	it("creates parent directory when missing (global scope analogue)", async () => {
		// Simulate a global-style nested config dir under the temp project
		const nested = join(tempDir, "nested", "config");
		await mkdir(nested, { recursive: true });
		process.chdir(nested);

		const result = await ensureOpenCodeModel({ global: false });
		expect(result.action).toBe("created");
	});

	it("treats empty/whitespace model as missing and adds default", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ model: "   ", mcp: { foo: {} } }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({ global: false });

		expect(result.action).toBe("added");
		expect(result.model).toBe(OPENCODE_DEFAULT_MODEL);
		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
		expect(contents.mcp).toEqual({ foo: {} });
	});

	it("treats non-string model as missing and adds default", async () => {
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ model: 123 }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({ global: false });

		expect(result.action).toBe("added");
		expect(result.model).toBe(OPENCODE_DEFAULT_MODEL);
	});
});

describe("ensureOpenCodeModel (global scope)", () => {
	let tempHome: string;

	beforeEach(async () => {
		tempHome = await mkdtemp(join(tmpdir(), "ck-opencode-home-"));
	});

	afterEach(async () => {
		setTaxonomyOverrides(undefined);
		await rm(tempHome, { recursive: true, force: true });
	});

	it("writes to ~/.config/opencode/opencode.json when global:true", async () => {
		const result = await ensureOpenCodeModel({ global: true, homeDir: tempHome });

		expect(result.action).toBe("created");
		expect(result.path).toBe(join(tempHome, ".config", "opencode", "opencode.json"));
		expect(result.model).toBe(OPENCODE_DEFAULT_MODEL);
		const contents = JSON.parse(await readFile(result.path, "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
	});

	it(".ck.json override takes precedence over fallback default", async () => {
		setTaxonomyOverrides({
			opencode: { default: { model: "custom/local-model" } },
		});

		const result = await ensureOpenCodeModel({ global: true, homeDir: tempHome });
		expect(result.model).toBe("custom/local-model");
		expect(result.reason).toContain("override");
	});

	it("suggests OPENCODE_DEFAULT_MODEL when no override", async () => {
		const suggestion = await suggestOpenCodeDefaultModel(tempHome);
		expect(suggestion.model).toBe(OPENCODE_DEFAULT_MODEL);
		expect(suggestion.reason).toContain("fallback");
	});

	it("prompter receives detected providers from auth.json", async () => {
		const authDir = join(tempHome, ".local", "share", "opencode");
		await mkdir(authDir, { recursive: true });
		await writeFile(
			join(authDir, "auth.json"),
			JSON.stringify({ anthropic: {}, openai: {} }),
			"utf-8",
		);

		let capturedProviders: string[] = [];
		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			interactive: true,
			prompter: async (ctx) => {
				capturedProviders = ctx.detectedProviders;
				return { action: "accept" };
			},
		});

		expect(capturedProviders).toEqual(["anthropic", "openai"]);
		expect(result.action).toBe("created");
		expect(result.model).toBe(OPENCODE_DEFAULT_MODEL);
	});

	it("interactive accept writes the suggested model", async () => {
		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			interactive: true,
			prompter: async () => ({ action: "accept" }),
		});

		expect(result.action).toBe("created");
		expect(result.model).toBe(OPENCODE_DEFAULT_MODEL);
		const contents = JSON.parse(await readFile(result.path, "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
	});

	it("interactive custom writes user-provided model", async () => {
		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			interactive: true,
			prompter: async () => ({ action: "custom", value: "openrouter/x-ai/grok-4" }),
		});

		expect(result.action).toBe("created");
		expect(result.model).toBe("openrouter/x-ai/grok-4");
		const contents = JSON.parse(await readFile(result.path, "utf-8"));
		expect(contents.model).toBe("openrouter/x-ai/grok-4");
	});

	it("interactive skip leaves file untouched and returns action:skipped", async () => {
		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			interactive: true,
			prompter: async () => ({ action: "skip" }),
		});

		expect(result.action).toBe("skipped");
		expect(result.model).toBe("");
		// File must not have been created
		await expect(readFile(result.path, "utf-8")).rejects.toThrow();
	});

	it("non-object JSON (array) is overwritten with warning", async () => {
		const globalDir = join(tempHome, ".config", "opencode");
		await mkdir(globalDir, { recursive: true });
		await writeFile(join(globalDir, "opencode.json"), "[]", "utf-8");

		const result = await ensureOpenCodeModel({ global: true, homeDir: tempHome });

		expect(result.action).toBe("created");
		const contents = JSON.parse(await readFile(result.path, "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
	});

	it("preserves existing fields in global config", async () => {
		const globalDir = join(tempHome, ".config", "opencode");
		await mkdir(globalDir, { recursive: true });
		await writeFile(
			join(globalDir, "opencode.json"),
			JSON.stringify({ mcp: { x: { command: ["y"] } } }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({ global: true, homeDir: tempHome });

		expect(result.action).toBe("added");
		const contents = JSON.parse(await readFile(result.path, "utf-8"));
		expect(contents.model).toBe(OPENCODE_DEFAULT_MODEL);
		expect(contents.mcp).toEqual({ x: { command: ["y"] } });
	});
});
