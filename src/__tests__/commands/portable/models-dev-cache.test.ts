/**
 * Tests for models-dev-cache.ts
 * Covers: cache miss/hit/stale/malformed, fetch failures, ModelsDevUnavailableError.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type FetchFn,
	type ModelsDevCatalog,
	ModelsDevUnavailableError,
	getModelsDevCatalog,
} from "@/commands/portable/models-dev-cache.js";
import { logger } from "@/shared/logger.js";

// ---- Fixtures ----

const MINIMAL_CATALOG: ModelsDevCatalog = {
	opencode: {
		id: "opencode",
		name: "OpenCode Zen",
		models: {
			"qwen3.5-plus-free": {
				id: "qwen3.5-plus-free",
				tool_call: true,
				release_date: "2025-06-01",
			},
			"glm-4.7-free": {
				id: "glm-4.7-free",
				tool_call: true,
				release_date: "2025-05-01",
			},
			"paid-model": {
				id: "paid-model",
				tool_call: true,
				release_date: "2025-07-01",
			},
		},
	},
};

function makeOkFetcher(catalog: ModelsDevCatalog): FetchFn {
	return async (_input, _init) => {
		return new Response(JSON.stringify(catalog), {
			status: 200,
			headers: { "content-type": "application/json", etag: '"abc123"' },
		});
	};
}

function makeFailFetcher(message = "Network error"): FetchFn {
	return async (_input, _init) => {
		throw new Error(message);
	};
}

function make404Fetcher(): FetchFn {
	return async (_input, _init) => {
		return new Response("Not Found", { status: 404 });
	};
}

// ---- Helpers ----

async function makeTmpCacheDir(): Promise<string> {
	return mkdtemp(join(tmpdir(), "ck-models-dev-cache-test-"));
}

function makeStaleCacheEntry(catalog: ModelsDevCatalog, ageMs = 25 * 60 * 60 * 1000) {
	const staleDate = new Date(Date.now() - ageMs).toISOString();
	return JSON.stringify({ fetchedAt: staleDate, payload: catalog });
}

function makeFreshCacheEntry(catalog: ModelsDevCatalog) {
	return JSON.stringify({ fetchedAt: new Date().toISOString(), payload: catalog });
}

// ---- Tests ----

describe("getModelsDevCatalog", () => {
	let cacheDir: string;

	beforeEach(async () => {
		cacheDir = await makeTmpCacheDir();
	});

	afterEach(async () => {
		await rm(cacheDir, { recursive: true, force: true });
	});

	it("cache miss — fetches and writes cache", async () => {
		let fetchCalled = false;
		const fetcher: FetchFn = async (input, init) => {
			fetchCalled = true;
			return makeOkFetcher(MINIMAL_CATALOG)(input, init);
		};

		const catalog = await getModelsDevCatalog({ fetcher, cacheDir });

		expect(fetchCalled).toBe(true);
		expect(catalog.opencode).toBeDefined();
		expect(catalog.opencode.models["qwen3.5-plus-free"]).toBeDefined();

		// Verify cache was written
		const cacheFile = join(cacheDir, "models-dev.json");
		const raw = await readFile(cacheFile, "utf-8");
		const cached = JSON.parse(raw) as { fetchedAt: string; payload: ModelsDevCatalog };
		expect(cached.fetchedAt).toBeDefined();
		expect(cached.payload.opencode).toBeDefined();
	});

	it("cache hit within 24h — no fetch", async () => {
		// Write fresh cache
		const cacheFile = join(cacheDir, "models-dev.json");
		await writeFile(cacheFile, makeFreshCacheEntry(MINIMAL_CATALOG), "utf-8");

		let fetchCalled = false;
		const fetcher: FetchFn = async () => {
			fetchCalled = true;
			return makeOkFetcher(MINIMAL_CATALOG)("https://models.dev/api.json");
		};

		const catalog = await getModelsDevCatalog({ fetcher, cacheDir });

		expect(fetchCalled).toBe(false);
		expect(catalog.opencode).toBeDefined();
	});

	it("cache stale (>24h) — fetches fresh data", async () => {
		const cacheFile = join(cacheDir, "models-dev.json");
		await writeFile(cacheFile, makeStaleCacheEntry(MINIMAL_CATALOG), "utf-8");

		let fetchCalled = false;
		const fetcher: FetchFn = async (input, init) => {
			fetchCalled = true;
			return makeOkFetcher(MINIMAL_CATALOG)(input, init);
		};

		await getModelsDevCatalog({ fetcher, cacheDir });

		expect(fetchCalled).toBe(true);
	});

	it("fetch fails + stale cache exists — returns stale + logs warning", async () => {
		const cacheFile = join(cacheDir, "models-dev.json");
		await writeFile(cacheFile, makeStaleCacheEntry(MINIMAL_CATALOG), "utf-8");

		const warnSpy = spyOn(logger, "warning");

		const catalog = await getModelsDevCatalog({
			fetcher: makeFailFetcher("Network error"),
			cacheDir,
		});

		expect(catalog.opencode).toBeDefined();
		expect(warnSpy).toHaveBeenCalled();

		warnSpy.mockRestore();
	});

	it("fetch fails + no cache — throws ModelsDevUnavailableError", async () => {
		await expect(
			getModelsDevCatalog({
				fetcher: makeFailFetcher("DNS failure"),
				cacheDir,
			}),
		).rejects.toBeInstanceOf(ModelsDevUnavailableError);
	});

	it("fetch returns non-200 + no cache — throws ModelsDevUnavailableError", async () => {
		await expect(
			getModelsDevCatalog({
				fetcher: make404Fetcher(),
				cacheDir,
			}),
		).rejects.toBeInstanceOf(ModelsDevUnavailableError);
	});

	it("malformed cache JSON — treats as miss, fetches fresh", async () => {
		const cacheFile = join(cacheDir, "models-dev.json");
		await writeFile(cacheFile, "not valid json {{{", "utf-8");

		let fetchCalled = false;
		const fetcher: FetchFn = async (input, init) => {
			fetchCalled = true;
			return makeOkFetcher(MINIMAL_CATALOG)(input, init);
		};

		const catalog = await getModelsDevCatalog({ fetcher, cacheDir });

		expect(fetchCalled).toBe(true);
		expect(catalog.opencode).toBeDefined();
	});

	it("cache entry missing payload field — treats as miss, fetches fresh", async () => {
		const cacheFile = join(cacheDir, "models-dev.json");
		await writeFile(
			cacheFile,
			JSON.stringify({ fetchedAt: new Date().toISOString() /* no payload */ }),
			"utf-8",
		);

		let fetchCalled = false;
		const fetcher: FetchFn = async (input, init) => {
			fetchCalled = true;
			return makeOkFetcher(MINIMAL_CATALOG)(input, init);
		};

		const catalog = await getModelsDevCatalog({ fetcher, cacheDir });

		expect(fetchCalled).toBe(true);
		expect(catalog.opencode).toBeDefined();
	});

	it("write is atomic — cache file is valid JSON after write", async () => {
		await getModelsDevCatalog({
			fetcher: makeOkFetcher(MINIMAL_CATALOG),
			cacheDir,
		});

		const cacheFile = join(cacheDir, "models-dev.json");
		const raw = await readFile(cacheFile, "utf-8");
		// Must be valid JSON
		const parsed = JSON.parse(raw) as { fetchedAt: string; payload: unknown };
		expect(typeof parsed.fetchedAt).toBe("string");
		expect(typeof parsed.payload).toBe("object");
	});
});
