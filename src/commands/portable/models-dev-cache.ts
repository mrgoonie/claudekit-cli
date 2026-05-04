/**
 * models-dev-cache — fetch and cache the models.dev catalog.
 *
 * The catalog (~1.8MB) is fetched from https://models.dev/api.json and cached
 * at <cacheDir>/models-dev.json with a 24h TTL. Subsequent calls within the TTL
 * return the cached payload without a network hit.
 *
 * DI-friendly: accept `fetcher` (defaults to globalThis.fetch) and `cacheDir`
 * so tests can inject stubs and tmp dirs without touching the real FS.
 *
 * Atomic writes: data is written to a `.tmp` file then renamed so readers never
 * see a partial write.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

// ---- Fetch type alias ----
// Using a structural subset avoids coupling to Bun's `FetchFn` (which adds `preconnect`).
// Any real fetch implementation satisfies this interface.
export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

// ---- Public types ----

export interface ModelInfo {
	id: string;
	tool_call: boolean;
	release_date: string;
	[key: string]: unknown;
}

export interface ProviderInfo {
	id: string;
	name: string;
	models: Record<string, ModelInfo>;
	[key: string]: unknown;
}

/** Minimal typed catalog shape — only fields we use are strongly typed. */
export type ModelsDevCatalog = Record<string, ProviderInfo>;

/** Typed error thrown when the catalog is unavailable and no cache exists. */
export class ModelsDevUnavailableError extends Error {
	constructor(message: string, cause: unknown) {
		// Use the native Error.cause accessor (Node 16.9+) instead of shadowing it
		// with a manual field. Tests inspect via `.cause` either way.
		super(message, { cause });
		this.name = "ModelsDevUnavailableError";
	}
}

// ---- Internal types ----

interface CacheEntry {
	fetchedAt: string;
	payload: ModelsDevCatalog;
}

// ---- Constants ----

const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

// ---- Helpers ----

function defaultCacheDir(): string {
	return join(homedir(), ".config", "claudekit", "cache");
}

function cacheFilePath(cacheDir: string): string {
	return join(cacheDir, "models-dev.json");
}

function tmpFilePath(cacheDir: string): string {
	return join(cacheDir, "models-dev.json.tmp");
}

/** Read and validate a cache entry. Returns null on any parse/validation failure. */
async function readCacheEntry(cacheDir: string): Promise<CacheEntry | null> {
	const filePath = cacheFilePath(cacheDir);
	try {
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (
			parsed !== null &&
			typeof parsed === "object" &&
			!Array.isArray(parsed) &&
			"fetchedAt" in parsed &&
			typeof (parsed as CacheEntry).fetchedAt === "string" &&
			"payload" in parsed &&
			typeof (parsed as CacheEntry).payload === "object" &&
			(parsed as CacheEntry).payload !== null
		) {
			return parsed as CacheEntry;
		}
		// Valid JSON but wrong shape — treat as miss
		return null;
	} catch {
		// ENOENT, SyntaxError, etc. — all treated as cache miss
		return null;
	}
}

function isCacheFresh(entry: CacheEntry): boolean {
	const fetchedAt = new Date(entry.fetchedAt).getTime();
	return Date.now() - fetchedAt < CACHE_TTL_MS;
}

/** Atomically write a cache entry: write to .tmp then rename. */
async function writeCacheEntry(cacheDir: string, entry: CacheEntry): Promise<void> {
	await mkdir(cacheDir, { recursive: true });
	const tmp = tmpFilePath(cacheDir);
	const dest = cacheFilePath(cacheDir);
	await writeFile(tmp, JSON.stringify(entry), "utf-8");
	await rename(tmp, dest);
}

/** Fetch catalog from models.dev with a timeout. Throws on non-2xx or network error. */
async function fetchCatalog(fetcher: FetchFn): Promise<ModelsDevCatalog> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetcher(MODELS_DEV_URL, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`models.dev returned HTTP ${response.status}`);
		}
		const json = (await response.json()) as unknown;
		// Basic shape validation — catalog must be a non-null object
		if (json === null || typeof json !== "object" || Array.isArray(json)) {
			throw new Error("models.dev response is not an object");
		}
		return json as ModelsDevCatalog;
	} finally {
		clearTimeout(timer);
	}
}

// ---- Public API ----

export interface GetModelsDevCatalogOptions {
	/** Inject a fetch implementation (for tests). Defaults to globalThis.fetch. */
	fetcher?: FetchFn;
	/** Override the cache directory. Defaults to ~/.config/claudekit/cache. */
	cacheDir?: string;
}

/**
 * Get the models.dev catalog, using a 24h cache.
 *
 * Resolution order:
 * 1. Fresh cache (< 24h old) → return immediately, no network.
 * 2. Stale cache or no cache → fetch from models.dev.
 *    a. Fetch success → write new cache, return fresh data.
 *    b. Fetch failure + stale cache → log warning, return stale data.
 *    c. Fetch failure + no cache → throw ModelsDevUnavailableError.
 */
export async function getModelsDevCatalog(
	opts: GetModelsDevCatalogOptions = {},
): Promise<ModelsDevCatalog> {
	const cacheDir = opts.cacheDir ?? defaultCacheDir();
	// Cast needed: globalThis.fetch in Bun has extra `preconnect` property not in FetchFn.
	// The cast is safe — we only call the core fetch(input, init) signature.
	const fetcher = opts.fetcher ?? (globalThis.fetch as unknown as FetchFn);

	const cached = await readCacheEntry(cacheDir);

	// Cache hit — return immediately
	if (cached !== null && isCacheFresh(cached)) {
		return cached.payload;
	}

	// Cache stale or missing — try to fetch
	try {
		const payload = await fetchCatalog(fetcher);
		const entry: CacheEntry = {
			fetchedAt: new Date().toISOString(),
			payload,
		};
		// Best-effort cache write — failure here should not block the caller
		try {
			await writeCacheEntry(cacheDir, entry);
		} catch (writeErr) {
			logger.verbose(`models-dev-cache: failed to write cache to ${cacheDir}: ${String(writeErr)}`);
		}
		return payload;
	} catch (fetchErr) {
		if (cached !== null) {
			// Stale fallback — serve stale data with a warning
			logger.warning(
				`models-dev-cache: fetch failed (${String(fetchErr)}), using stale cache from ${cached.fetchedAt}`,
			);
			return cached.payload;
		}
		// No cache at all — caller must handle
		throw new ModelsDevUnavailableError(
			`models.dev catalog unavailable: ${String(fetchErr)}`,
			fetchErr,
		);
	}
}
