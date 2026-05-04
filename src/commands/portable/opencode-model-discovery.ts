/**
 * opencode-model-discovery — auth-first resolver for the opencode default model.
 *
 * Reads opencode's `auth.json` at the XDG-data path opencode uses
 * (`Global.Path.data` upstream — see
 * https://github.com/sst/opencode/blob/dev/packages/core/src/global.ts which
 * binds to `xdg-basedir`'s `xdgData`). We replicate that resolution locally
 * (no new runtime dep): POSIX uses `XDG_DATA_HOME` env or `~/.local/share`;
 * Windows uses `LOCALAPPDATA` or `~/AppData/Local`. macOS follows POSIX here
 * because `xdg-basedir` does the same.
 *
 * Resolves the best model from the models.dev catalog with these rules:
 *
 * Priority order:
 * 1. Provider `opencode` (OpenCode Zen) wins if auth'd — prefers *-free models with
 *    tool_call: true sorted by release_date desc; falls back to any tool-callable model.
 * 2. Other auth'd providers: pick newest tool-callable model by release_date desc.
 * 3. Provider not in catalog or has no tool-callable models → skip, try next.
 * 4. No usable provider found → return failure with a discriminated `reason`.
 *
 * Returns a `DiscoveryResult` discriminated union (not throws) when discovery cannot
 * determine a model — callers decide whether to prompt interactively or fail-fast,
 * and can render an accurate error message based on the `reason` field.
 */
import { readFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";
import {
	type FetchFn,
	type ModelInfo,
	type ModelsDevCatalog,
	ModelsDevUnavailableError,
	getModelsDevCatalog,
} from "./models-dev-cache.js";

// ---- Public types ----

export interface DiscoveredModel {
	/** Full model string in provider/model format, e.g. "opencode/qwen3.5-plus-free" */
	model: string;
	/** Human-readable reason for this selection, for display in prompts. */
	reason: string;
	/** All detected provider IDs from auth.json, for informational display. */
	authedProviders: string[];
}

/**
 * Distinct failure reasons so callers can surface accurate messages instead of
 * always blaming missing auth.
 */
export type DiscoveryFailureReason =
	/** auth.json missing, malformed, or empty — user has not run `opencode auth login`. */
	| "no-auth"
	/** auth.json has providers but models.dev is unreachable and no cache exists. */
	| "catalog-unavailable"
	/** auth.json has providers but none of them have any tool-callable model in the catalog. */
	| "no-usable-model";

export type DiscoveryResult =
	| { ok: true; value: DiscoveredModel }
	| {
			ok: false;
			reason: DiscoveryFailureReason;
			/** Provider IDs read from auth.json (empty when reason is "no-auth"). */
			authedProviders: string[];
	  };

// ---- Helpers ----

/**
 * Resolve the directory `auth.json` lives in, mirroring opencode's `Global.Path.data`.
 * Exported so the installer reuses the exact same resolution.
 *
 * Upstream reference: `xdg-basedir` library used by `packages/core/src/global.ts`
 * in sst/opencode (xdgData → XDG_DATA_HOME or ~/.local/share on POSIX, LOCALAPPDATA
 * or ~/AppData/Local on Windows).
 */
export function resolveOpenCodeAuthPath(homeDir: string): string {
	if (platform() === "win32") {
		const dataRoot = process.env.LOCALAPPDATA ?? join(homeDir, "AppData", "Local");
		return join(dataRoot, "opencode", "auth.json");
	}
	const dataRoot = process.env.XDG_DATA_HOME ?? join(homeDir, ".local", "share");
	return join(dataRoot, "opencode", "auth.json");
}

/** Parse auth.json and return the list of provider IDs. Returns [] on any failure. */
export async function readAuthedProviders(homeDir: string): Promise<string[]> {
	const authPath = resolveOpenCodeAuthPath(homeDir);
	try {
		const raw = await readFile(authPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
			return Object.keys(parsed as Record<string, unknown>);
		}
	} catch {
		// ENOENT or malformed JSON — silently return empty
	}
	return [];
}

/** Parse release_date string → timestamp ms for sorting. Returns 0 on invalid date. */
function releaseDateMs(model: ModelInfo): number {
	const d = new Date(model.release_date);
	return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Sort models by release_date descending (newest first). */
function sortByDateDesc(models: ModelInfo[]): ModelInfo[] {
	return [...models].sort((a, b) => releaseDateMs(b) - releaseDateMs(a));
}

/**
 * Pick the best model for the `opencode` provider:
 * - Prefer *-free models with tool_call: true, sorted by release_date desc.
 * - Fall back to any tool-callable model if no free models exist.
 */
function pickOpenCodeModel(models: Record<string, ModelInfo>): ModelInfo | null {
	const all = Object.values(models);

	// Phase 1: free models with tool_call
	const freeCallable = all.filter((m) => m.tool_call && m.id.endsWith("-free"));
	const sortedFree = sortByDateDesc(freeCallable);
	const topFree = sortedFree[0];
	if (topFree !== undefined) {
		return topFree;
	}

	// Phase 2: any tool-callable (no free constraint)
	const callable = all.filter((m) => m.tool_call);
	const sortedCallable = sortByDateDesc(callable);
	return sortedCallable[0] ?? null;
}

/**
 * Pick the best model for a non-opencode provider:
 * - Newest tool-callable model by release_date desc.
 */
function pickGenericModel(models: Record<string, ModelInfo>): ModelInfo | null {
	const callable = Object.values(models).filter((m) => m.tool_call);
	const sorted = sortByDateDesc(callable);
	return sorted[0] ?? null;
}

// ---- Public API ----

export interface ResolveOpenCodeDefaultModelOptions {
	/** Override home directory (for tests). Defaults to os.homedir(). */
	homeDir?: string;
	/** Override cache directory for models.dev (for tests). */
	cacheDir?: string;
	/** Inject fetch implementation (for tests). Defaults to globalThis.fetch. */
	fetcher?: FetchFn;
}

/**
 * Resolve the best opencode default model based on the user's authenticated providers.
 *
 * Returns a discriminated `DiscoveryResult`:
 * - `{ ok: true, value }` on success.
 * - `{ ok: false, reason: "no-auth", authedProviders: [] }` when auth.json is missing/empty.
 * - `{ ok: false, reason: "catalog-unavailable", authedProviders }` when models.dev fetch fails
 *    and no cache exists.
 * - `{ ok: false, reason: "no-usable-model", authedProviders }` when no auth'd provider has any
 *    tool-callable model in the catalog.
 */
export async function resolveOpenCodeDefaultModel(
	opts: ResolveOpenCodeDefaultModelOptions = {},
): Promise<DiscoveryResult> {
	const home = opts.homeDir ?? homedir();

	// Step 1: read auth'd providers
	const authedProviders = await readAuthedProviders(home);
	if (authedProviders.length === 0) {
		return { ok: false, reason: "no-auth", authedProviders: [] };
	}

	// Step 2: load catalog
	let catalog: ModelsDevCatalog;
	try {
		catalog = await getModelsDevCatalog({ fetcher: opts.fetcher, cacheDir: opts.cacheDir });
	} catch (err) {
		if (err instanceof ModelsDevUnavailableError) {
			logger.verbose(
				`opencode-model-discovery: models.dev unavailable, cannot auto-resolve model: ${err.message}`,
			);
			return { ok: false, reason: "catalog-unavailable", authedProviders };
		}
		throw err;
	}

	// Step 3: determine provider resolution order — `opencode` always first
	const orderedProviders = [
		...authedProviders.filter((id) => id === "opencode"),
		...authedProviders.filter((id) => id !== "opencode"),
	];

	// Step 4: iterate providers, pick first with a usable model
	for (const providerId of orderedProviders) {
		const providerEntry = catalog[providerId];
		if (!providerEntry) {
			// Provider not in catalog — skip
			continue;
		}

		const picked =
			providerId === "opencode"
				? pickOpenCodeModel(providerEntry.models)
				: pickGenericModel(providerEntry.models);

		if (!picked) {
			// Provider has zero tool-callable models — skip
			continue;
		}

		const isFree = picked.id.endsWith("-free");
		const tierLabel = isFree ? "free tier" : "paid";
		const reason = `auth-detected: ${providerId} (${tierLabel}, released ${picked.release_date})`;

		return {
			ok: true,
			value: {
				model: `${providerId}/${picked.id}`,
				reason,
				authedProviders,
			},
		};
	}

	// No usable provider found
	return { ok: false, reason: "no-usable-model", authedProviders };
}
