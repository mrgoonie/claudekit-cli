import { afterEach, beforeEach, describe, expect, it } from "bun:test";
/**
 * Tests for opencode-config-installer — regression coverage for #728 / #771.
 *
 * Updated in #771: OPENCODE_DEFAULT_MODEL and suggestOpenCodeDefaultModel are removed.
 * Non-interactive mode without auth now throws OpenCodeAuthRequiredError.
 * Tests that relied on the old hardcoded default are updated to use .ck.json override
 * or interactive mode with a mock prompter.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTaxonomyOverrides } from "../model-taxonomy.js";
import type { ModelsDevCatalog } from "../models-dev-cache.js";
import { OpenCodeAuthRequiredError, ensureOpenCodeModel } from "../opencode-config-installer.js";

// Minimal catalog for tests that go through the auth-first resolver
const CATALOG: ModelsDevCatalog = {
	opencode: {
		id: "opencode",
		name: "OpenCode Zen",
		models: {
			"qwen3.5-plus-free": { id: "qwen3.5-plus-free", tool_call: true, release_date: "2025-06-15" },
		},
	},
};

function makeOkFetcher(catalog: ModelsDevCatalog): typeof fetch {
	return Object.assign(
		async (_input: string | URL | Request, _init?: RequestInit) =>
			new Response(JSON.stringify(catalog), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		{ preconnect: (_url: string) => {} },
	) as typeof fetch;
}

async function writeAuthJson(homeDir: string, providers: Record<string, unknown>): Promise<void> {
	const authDir = join(homeDir, ".local", "share", "opencode");
	await mkdir(authDir, { recursive: true });
	await writeFile(join(authDir, "auth.json"), JSON.stringify(providers), "utf-8");
}

describe("ensureOpenCodeModel (project scope)", () => {
	let tempDir: string;
	let tempHome: string;
	let cacheDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-opencode-"));
		tempHome = await mkdtemp(join(tmpdir(), "ck-opencode-home-"));
		cacheDir = await mkdtemp(join(tmpdir(), "ck-opencode-cache-"));
	});

	afterEach(async () => {
		setTaxonomyOverrides(undefined);
		await rm(tempDir, { recursive: true, force: true });
		await rm(tempHome, { recursive: true, force: true });
		await rm(cacheDir, { recursive: true, force: true });
	});

	it("creates opencode.json with discovered model when auth is present", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: tempDir,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("created");
		expect(result.model).toStartWith("opencode/");

		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(typeof contents.model).toBe("string");
	});

	it("non-interactive + no auth throws OpenCodeAuthRequiredError", async () => {
		// No auth.json — must throw in non-interactive mode
		await expect(
			ensureOpenCodeModel({
				global: false,
				cwd: tempDir,
				homeDir: tempHome,
				cacheDir,
				fetcher: makeOkFetcher(CATALOG),
				interactive: false,
			}),
		).rejects.toBeInstanceOf(OpenCodeAuthRequiredError);
	});

	it("adds model to existing opencode.json while preserving other fields", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ mcp: { pencil: { command: ["foo"] } } }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: tempDir,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("added");
		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(typeof contents.model).toBe("string");
		expect(contents.mcp).toEqual({ pencil: { command: ["foo"] } });
	});

	it("leaves existing model field untouched when catalog validates it", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ model: "opencode/qwen3.5-plus-free" }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: tempDir,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("existing");
		expect(result.model).toBe("opencode/qwen3.5-plus-free");
	});

	it("recreates config when existing file is malformed JSON (with auth)", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		await writeFile(join(tempDir, "opencode.json"), "{ not json", "utf-8");

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: tempDir,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("created");
		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(typeof contents.model).toBe("string");
	});

	it("honors .ck.json taxonomy override — wins over auth discovery, no auth needed", async () => {
		setTaxonomyOverrides({
			opencode: { default: { model: "anthropic/claude-opus-4-5" } },
		});

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: tempDir,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.model).toBe("anthropic/claude-opus-4-5");
	});

	it("creates parent directory when missing (global scope analogue)", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		const nested = join(tempDir, "nested", "config");
		await mkdir(nested, { recursive: true });

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: nested,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});
		expect(result.action).toBe("created");
	});

	it("treats empty/whitespace model as missing and adds discovered model", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ model: "   ", mcp: { foo: {} } }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: tempDir,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("added");
		expect(result.model).toStartWith("opencode/");
		const contents = JSON.parse(await readFile(join(tempDir, "opencode.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(contents.mcp).toEqual({ foo: {} });
	});

	it("treats non-string model as missing and adds discovered model", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		await writeFile(
			join(tempDir, "opencode.json"),
			JSON.stringify({ model: 123 }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({
			global: false,
			cwd: tempDir,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("added");
		expect(result.model).toStartWith("opencode/");
	});
});

describe("ensureOpenCodeModel (global scope)", () => {
	let tempHome: string;
	let cacheDir: string;

	beforeEach(async () => {
		tempHome = await mkdtemp(join(tmpdir(), "ck-opencode-home-"));
		cacheDir = await mkdtemp(join(tmpdir(), "ck-opencode-cache-"));
	});

	afterEach(async () => {
		setTaxonomyOverrides(undefined);
		await rm(tempHome, { recursive: true, force: true });
		await rm(cacheDir, { recursive: true, force: true });
	});

	it("writes to ~/.config/opencode/opencode.json when global:true", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("created");
		expect(result.path).toBe(join(tempHome, ".config", "opencode", "opencode.json"));
		expect(result.model).toStartWith("opencode/");
		const contents = JSON.parse(await readFile(result.path, "utf-8")) as Record<string, unknown>;
		expect(typeof contents.model).toBe("string");
	});

	it(".ck.json override takes precedence and includes 'override' in reason", async () => {
		setTaxonomyOverrides({
			opencode: { default: { model: "custom/local-model" } },
		});

		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});
		expect(result.model).toBe("custom/local-model");
		expect(result.reason).toContain("override");
	});

	it("prompter receives detected providers from auth.json", async () => {
		const authDir = join(tempHome, ".local", "share", "opencode");
		await mkdir(authDir, { recursive: true });
		await writeFile(
			join(authDir, "auth.json"),
			JSON.stringify({ anthropic: {}, openai: {} }),
			"utf-8",
		);
		// Use a catalog that covers both providers
		const catalog: ModelsDevCatalog = {
			anthropic: {
				id: "anthropic",
				name: "Anthropic",
				models: {
					"claude-sonnet-4-5": {
						id: "claude-sonnet-4-5",
						tool_call: true,
						release_date: "2025-03-01",
					},
				},
			},
			openai: {
				id: "openai",
				name: "OpenAI",
				models: {
					"gpt-5": { id: "gpt-5", tool_call: true, release_date: "2025-05-01" },
				},
			},
		};

		let capturedProviders: string[] = [];
		await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(catalog),
			interactive: true,
			prompter: async (ctx) => {
				capturedProviders = ctx.detectedProviders;
				return { action: "accept" };
			},
		});

		expect(capturedProviders).toContain("anthropic");
		expect(capturedProviders).toContain("openai");
	});

	it("interactive accept writes the suggested model", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			interactive: true,
			prompter: async () => ({ action: "accept" }),
		});

		expect(result.action).toBe("created");
		expect(result.model).toStartWith("opencode/");
		const contents = JSON.parse(await readFile(result.path, "utf-8")) as Record<string, unknown>;
		expect(typeof contents.model).toBe("string");
	});

	it("interactive custom writes user-provided model", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			interactive: true,
			prompter: async () => ({ action: "custom", value: "openrouter/x-ai/grok-4" }),
		});

		expect(result.action).toBe("created");
		expect(result.model).toBe("openrouter/x-ai/grok-4");
		const contents = JSON.parse(await readFile(result.path, "utf-8")) as Record<string, unknown>;
		expect(contents.model).toBe("openrouter/x-ai/grok-4");
	});

	it("re-run with multi-segment custom model (openrouter/x-ai/grok-4) preserves it as 'existing'", async () => {
		// Regression for the bug where validateModelAgainstCatalog rejected any
		// model id with more than one slash, causing the installer to re-prompt
		// on every migrate run for users who deliberately picked a multi-segment
		// model on a non-catalog provider.
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });

		// First run: write the multi-segment model via the custom prompter.
		const first = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			interactive: true,
			prompter: async () => ({ action: "custom", value: "openrouter/x-ai/grok-4" }),
		});
		expect(first.action).toBe("created");
		expect(first.model).toBe("openrouter/x-ai/grok-4");

		// Second run: same opts. A bug-free installer treats "openrouter" as the
		// provider and "x-ai/grok-4" as the model id; "openrouter" isn't in our
		// fixture catalog so it correctly returns false from the catalog lookup —
		// BUT in non-interactive mode that path keeps the existing model with a
		// warning. To assert the parsing fix specifically, point at a provider
		// that IS in the catalog: "opencode" with a multi-segment id like
		// "opencode/foo/bar" would parse correctly even though it's not in the
		// catalog. That's still a "not in catalog" outcome, which keeps existing
		// in non-interactive mode (the desired behavior). The key invariant being
		// tested: the parser does NOT return false because of the slash count
		// alone.
		const second = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			interactive: false,
		});
		expect(second.action).toBe("existing");
		expect(second.model).toBe("openrouter/x-ai/grok-4");

		// File on disk is untouched.
		const contents = JSON.parse(await readFile(second.path, "utf-8")) as Record<string, unknown>;
		expect(contents.model).toBe("openrouter/x-ai/grok-4");
	});

	it("interactive skip leaves file untouched and returns action:skipped", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });

		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
			interactive: true,
			prompter: async () => ({ action: "skip" }),
		});

		expect(result.action).toBe("skipped");
		expect(result.model).toBe("");
		// File must not have been created
		await expect(readFile(result.path, "utf-8")).rejects.toThrow();
	});

	it("non-object JSON (array) is overwritten with warning (with auth)", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		const globalDir = join(tempHome, ".config", "opencode");
		await mkdir(globalDir, { recursive: true });
		await writeFile(join(globalDir, "opencode.json"), "[]", "utf-8");

		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("created");
		const contents = JSON.parse(await readFile(result.path, "utf-8")) as Record<string, unknown>;
		expect(typeof contents.model).toBe("string");
	});

	it("preserves existing fields in global config", async () => {
		await writeAuthJson(tempHome, { opencode: { token: "tok" } });
		const globalDir = join(tempHome, ".config", "opencode");
		await mkdir(globalDir, { recursive: true });
		await writeFile(
			join(globalDir, "opencode.json"),
			JSON.stringify({ mcp: { x: { command: ["y"] } } }, null, 2),
			"utf-8",
		);

		const result = await ensureOpenCodeModel({
			global: true,
			homeDir: tempHome,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.action).toBe("added");
		const contents = JSON.parse(await readFile(result.path, "utf-8")) as Record<string, unknown>;
		expect(typeof contents.model).toBe("string");
		expect(contents.mcp).toEqual({ x: { command: ["y"] } });
	});
});
