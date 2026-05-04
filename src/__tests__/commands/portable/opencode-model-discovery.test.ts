/**
 * Tests for opencode-model-discovery.ts
 * Covers: auth detection, free-model priority, multi-provider ranking, offline behavior.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FetchFn, ModelsDevCatalog } from "@/commands/portable/models-dev-cache.js";
import { resolveOpenCodeDefaultModel } from "@/commands/portable/opencode-model-discovery.js";

// ---- Fixtures ----

/**
 * Realistic subset of models.dev catalog:
 * - opencode provider: 2 free models (tool_call: true) + 1 paid + 1 no tool_call
 * - anthropic provider: 1 model with tool_call
 */
const CATALOG: ModelsDevCatalog = {
	opencode: {
		id: "opencode",
		name: "OpenCode Zen",
		models: {
			"qwen3.5-plus-free": {
				id: "qwen3.5-plus-free",
				tool_call: true,
				release_date: "2025-06-15",
			},
			"glm-4.7-free": {
				id: "glm-4.7-free",
				tool_call: true,
				release_date: "2025-05-01",
			},
			"mimo-v2-pro-free": {
				id: "mimo-v2-pro-free",
				tool_call: false, // no tool_call — must be skipped
				release_date: "2025-07-01",
			},
			"premium-model": {
				id: "premium-model",
				tool_call: true,
				release_date: "2025-09-01", // newest — but not free
			},
		},
	},
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
	notoolfree: {
		id: "notoolfree",
		name: "NoToolFree",
		models: {
			"only-model": {
				id: "only-model",
				tool_call: false, // zero tool-callable models
				release_date: "2025-01-01",
			},
		},
	},
};

const CATALOG_ONLY_NONFREE_OPENCODE: ModelsDevCatalog = {
	opencode: {
		id: "opencode",
		name: "OpenCode Zen",
		models: {
			// No *-free models — only paid ones
			"paid-a": {
				id: "paid-a",
				tool_call: true,
				release_date: "2025-04-01",
			},
			"paid-b": {
				id: "paid-b",
				tool_call: true,
				release_date: "2025-06-01",
			},
		},
	},
};

function makeOkFetcher(catalog: ModelsDevCatalog): FetchFn {
	return async (_input, _init) =>
		new Response(JSON.stringify(catalog), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
}

// ---- Helpers ----

async function makeTmpHome(): Promise<string> {
	return mkdtemp(join(tmpdir(), "ck-model-discovery-test-"));
}

async function writeAuthJson(homeDir: string, providers: Record<string, unknown>): Promise<void> {
	const authDir = join(homeDir, ".local", "share", "opencode");
	await mkdir(authDir, { recursive: true });
	await writeFile(join(authDir, "auth.json"), JSON.stringify(providers), "utf-8");
}

// ---- Tests ----

describe("resolveOpenCodeDefaultModel", () => {
	let homeDir: string;
	let cacheDir: string;

	beforeEach(async () => {
		homeDir = await makeTmpHome();
		cacheDir = await mkdtemp(join(tmpdir(), "ck-model-discovery-cache-"));
	});

	afterEach(async () => {
		await rm(homeDir, { recursive: true, force: true });
		await rm(cacheDir, { recursive: true, force: true });
	});

	it("no auth.json file — returns null", async () => {
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});
		expect(result.ok).toBe(false);
	});

	it("empty auth.json ({}) — returns null", async () => {
		await writeAuthJson(homeDir, {});
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});
		expect(result.ok).toBe(false);
	});

	it("single auth opencode — returns newest *-free model with tool_call: true", async () => {
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.ok).toBe(true);
		// qwen3.5-plus-free has release_date 2025-06-15 > glm-4.7-free 2025-05-01
		expect(result.ok && result.value.model).toBe("opencode/qwen3.5-plus-free");
		expect(result.ok && result.value.reason).toContain("opencode");
		expect(result.ok && result.value.authedProviders).toContain("opencode");
	});

	it("opencode auth but no *-free models with tool_call — falls back to newest non-free tool-callable", async () => {
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG_ONLY_NONFREE_OPENCODE),
		});

		expect(result.ok).toBe(true);
		// paid-b has release_date 2025-06-01 > paid-a 2025-04-01
		expect(result.ok && result.value.model).toBe("opencode/paid-b");
	});

	it("multiple auth providers including opencode — opencode wins (priority)", async () => {
		await writeAuthJson(homeDir, {
			opencode: { token: "tok" },
			anthropic: { token: "ant" },
		});
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.ok).toBe(true);
		expect(result.ok && result.value.model).toStartWith("opencode/");
		expect(result.ok && result.value.authedProviders).toContain("anthropic");
		expect(result.ok && result.value.authedProviders).toContain("opencode");
	});

	it("multiple auth providers without opencode — picks first available with tool_call", async () => {
		await writeAuthJson(homeDir, { anthropic: { token: "ant" } });
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.ok).toBe(true);
		expect(result.ok && result.value.model).toBe("anthropic/claude-sonnet-4-5");
	});

	it("auth'd provider exists in catalog but has zero tool-callable models — falls through to next", async () => {
		await writeAuthJson(homeDir, {
			notoolfree: { token: "ntf" },
			anthropic: { token: "ant" },
		});
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.ok).toBe(true);
		// notoolfree has no tool_call: true models; should fall through to anthropic
		expect(result.ok && result.value.model).toBe("anthropic/claude-sonnet-4-5");
	});

	it("all auth'd providers have no tool-callable models — returns null", async () => {
		await writeAuthJson(homeDir, { notoolfree: { token: "ntf" } });
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.ok).toBe(false);
	});

	it("models.dev unavailable — returns null with reason", async () => {
		await writeAuthJson(homeDir, { opencode: { token: "tok" } });

		// Use a fetcher that throws ModelsDevUnavailableError (simulating no cache)
		const unavailableFetcher: FetchFn = async () => {
			throw new Error("Network error");
		};

		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir, // fresh tmp dir — no cache
			fetcher: unavailableFetcher,
		});

		// When catalog is unavailable, return null so caller can handle
		expect(result.ok).toBe(false);
	});

	it("auth'd provider not in catalog — skipped, falls through to next", async () => {
		await writeAuthJson(homeDir, {
			"unknown-provider": { token: "tok" },
			anthropic: { token: "ant" },
		});
		const result = await resolveOpenCodeDefaultModel({
			homeDir,
			cacheDir,
			fetcher: makeOkFetcher(CATALOG),
		});

		expect(result.ok).toBe(true);
		expect(result.ok && result.value.model).toBe("anthropic/claude-sonnet-4-5");
	});
});
