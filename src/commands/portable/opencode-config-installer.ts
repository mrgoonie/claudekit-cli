/**
 * OpenCode config installer — ensures opencode.json has a `model` set so migrated
 * agents can resolve a provider. Without a global model, OpenCode throws
 * `ProviderModelNotFoundError` on every agent invocation (#728).
 *
 * Writes to the minimal location: global at `~/.config/opencode/opencode.json`,
 * project at `<cwd>/opencode.json`. Preserves any existing fields; only fills in
 * `model` when missing or invalid.
 *
 * UX scope:
 * - `.ck.json` taxonomy override (`opencode.default.model`) always wins.
 * - Auth-first: reads ~/.local/share/opencode/auth.json, resolves model via
 *   models.dev catalog (#771). Non-interactive with no auth → fail-fast with hint.
 * - Existing valid model (passes catalog check) → preserved untouched.
 * - Existing invalid model → in non-interactive mode: keep + loud warning;
 *   in interactive mode: offer rewrite with discovery suggestion.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import * as p from "@clack/prompts";
import { getOpenCodeDefaultModelOverride } from "./model-taxonomy.js";
import {
	type FetchFn,
	type GetModelsDevCatalogOptions,
	getModelsDevCatalog,
} from "./models-dev-cache.js";
import {
	type DiscoveryFailureReason,
	readAuthedProviders,
	resolveOpenCodeDefaultModel,
} from "./opencode-model-discovery.js";

// ---- Exported error ----

/**
 * Thrown in non-interactive mode when discovery cannot determine a model.
 * Carries the discriminated reason so callers can surface accurate hints.
 *
 * - "no-auth": user has not run `opencode auth login`.
 * - "catalog-unavailable": models.dev unreachable; user may have valid auth.
 * - "no-usable-model": auth'd providers have no tool-callable models in catalog.
 */
export class OpenCodeAuthRequiredError extends Error {
	readonly reason: DiscoveryFailureReason;
	constructor(reason: DiscoveryFailureReason = "no-auth") {
		super(messageForReason(reason));
		this.name = "OpenCodeAuthRequiredError";
		this.reason = reason;
	}
}

function messageForReason(reason: DiscoveryFailureReason): string {
	switch (reason) {
		case "no-auth":
			return "opencode has no authenticated providers. Run `opencode auth login` first, then re-run `ck migrate`.";
		case "catalog-unavailable":
			return "Cannot reach models.dev to pick a default model. Check your network, then re-run `ck migrate` — or set `model` in opencode.json manually.";
		case "no-usable-model":
			return "None of your authenticated opencode providers have a tool-capable model in the models.dev catalog. Set `model` in opencode.json manually.";
	}
}

// ---- Public types ----

export interface EnsureOpenCodeModelResult {
	path: string;
	action: "added" | "existing" | "created" | "skipped";
	model: string;
	/** Human-readable reason for the chosen default. */
	reason?: string;
}

/**
 * Prompter abstraction — default uses `@clack/prompts`. Tests inject a stub.
 * Return `{ action: "accept" }` to use the suggested model, `{ action: "custom", value }`
 * to override, or `{ action: "skip" }` to skip writing.
 */
export type OpenCodeModelPrompter = (ctx: {
	suggestion: string;
	reason: string;
	detectedProviders: string[];
}) => Promise<{ action: "accept" } | { action: "custom"; value: string } | { action: "skip" }>;

export interface EnsureOpenCodeModelOptions {
	global: boolean;
	/** If true, call prompter before writing. Otherwise write suggested default silently. */
	interactive?: boolean;
	/** Override home directory (for tests). Defaults to `os.homedir()`. */
	homeDir?: string;
	/** Override project directory (for tests). Defaults to `process.cwd()`. */
	cwd?: string;
	/** Override cache directory for models.dev (for tests). */
	cacheDir?: string;
	/** Inject a prompter (for tests). Defaults to the clack-based prompter. */
	prompter?: OpenCodeModelPrompter;
	/** Inject a fetch implementation (for tests). Defaults to globalThis.fetch. */
	fetcher?: FetchFn;
}

// ---- Internal helpers ----

function getOpenCodeConfigPath(options: EnsureOpenCodeModelOptions): string {
	if (options.global) {
		// OpenCode's global config path — `~/.config/opencode/opencode.json` on all
		// platforms (OpenCode uses XDG layout even on Windows).
		return join(options.homeDir ?? homedir(), ".config", "opencode", "opencode.json");
	}
	return join(options.cwd ?? process.cwd(), "opencode.json");
}

function makeCatalogOpts(options: EnsureOpenCodeModelOptions): GetModelsDevCatalogOptions {
	return {
		fetcher: options.fetcher,
		cacheDir: options.cacheDir,
	};
}

/**
 * Validate an existing model string against the models.dev catalog.
 * Returns true if the model is in format "provider/model-id" AND both the provider
 * and model exist in the catalog.
 * Returns false if the catalog is unavailable (fail-open: don't invalidate on network error).
 */
async function validateModelAgainstCatalog(
	model: string,
	options: EnsureOpenCodeModelOptions,
): Promise<boolean> {
	// Split on the FIRST slash so multi-segment model ids like "openrouter/x-ai/grok-4"
	// are handled correctly (provider="openrouter", modelId="x-ai/grok-4"). The previous
	// `split + length===2` check incorrectly rejected these, causing re-prompts on
	// every migrate run for users who deliberately chose a multi-segment custom model.
	const slashIdx = model.indexOf("/");
	if (slashIdx <= 0 || slashIdx === model.length - 1) {
		return false; // Missing or empty provider/model segment
	}
	const providerId = model.slice(0, slashIdx);
	const modelId = model.slice(slashIdx + 1);

	try {
		const catalog = await getModelsDevCatalog(makeCatalogOpts(options));
		const provider = catalog[providerId];
		if (!provider) return false;
		return modelId in provider.models;
	} catch {
		// Catalog unavailable — fail-open (don't invalidate the user's existing model)
		return true;
	}
}

type SuggestionSuccess = {
	ok: true;
	model: string;
	reason: string;
	authedProviders: string[];
};

type SuggestionFailure = {
	ok: false;
	failure: DiscoveryFailureReason;
	authedProviders: string[];
};

type SuggestionResult = SuggestionSuccess | SuggestionFailure;

/**
 * Suggest a default model to write based on (in priority order):
 * 1. `.ck.json` taxonomy override (`opencode.default.model`) — always wins.
 * 2. Auth-first dynamic resolver via models.dev catalog (discriminated result).
 *
 * On failure, the discriminated `failure` field tells callers WHY (no-auth vs
 * catalog-unavailable vs no-usable-model) so they can render accurate hints
 * instead of always blaming missing auth.
 */
async function suggestModel(options: EnsureOpenCodeModelOptions): Promise<SuggestionResult> {
	const override = getOpenCodeDefaultModelOverride();
	if (override) {
		// Override path doesn't query auth; surface empty list (caller treats as opaque).
		return { ok: true, model: override, reason: ".ck.json override", authedProviders: [] };
	}

	const result = await resolveOpenCodeDefaultModel({
		homeDir: options.homeDir,
		fetcher: options.fetcher,
		cacheDir: options.cacheDir,
	});

	if (result.ok) {
		return {
			ok: true,
			model: result.value.model,
			reason: result.value.reason,
			authedProviders: result.value.authedProviders,
		};
	}

	return { ok: false, failure: result.reason, authedProviders: result.authedProviders };
}

/** Default clack-based prompter. */
const clackPrompter: OpenCodeModelPrompter = async ({ suggestion, reason, detectedProviders }) => {
	const providersHint =
		detectedProviders.length > 0
			? `Authenticated providers in opencode: ${detectedProviders.join(", ")}`
			: "No authenticated providers detected in opencode.";
	const response = await p.select({
		message: `No default model in opencode.json. ${providersHint}`,
		options: [
			{
				value: "accept",
				label: `Write "${suggestion}"`,
				hint: reason,
			},
			{ value: "custom", label: "Enter a different model..." },
			{ value: "skip", label: "Skip — I'll configure opencode.json myself" },
		],
		initialValue: "accept",
	});

	if (p.isCancel(response) || response === "skip") return { action: "skip" };
	if (response === "accept") return { action: "accept" };

	const custom = await p.text({
		message: "Model (format: provider/model-id, e.g. opencode/qwen3.5-plus-free)",
		placeholder: suggestion,
		validate: (value) => {
			if (!value || !value.includes("/")) return "Must be in 'provider/model-id' format";
			return undefined;
		},
	});
	if (p.isCancel(custom)) return { action: "skip" };
	return { action: "custom", value: custom };
};

/** Prompter shown when an existing model fails catalog validation. */
const makeInvalidModelPrompter =
	(existingModel: string, suggestion: string, reason: string): OpenCodeModelPrompter =>
	async ({ detectedProviders }) => {
		const providersHint =
			detectedProviders.length > 0
				? `Authenticated providers: ${detectedProviders.join(", ")}`
				: "No authenticated providers detected.";
		const response = await p.select({
			message: `Existing model "${existingModel}" is not in the models.dev catalog. ${providersHint}`,
			options: [
				{
					value: "rewrite",
					label: `Replace with "${suggestion}"`,
					hint: reason,
				},
				{
					value: "keep",
					label: `Keep "${existingModel}" as-is`,
					hint: "May cause ProviderModelNotFoundError at runtime",
				},
			],
			initialValue: "rewrite",
		});

		if (p.isCancel(response) || response === "keep") return { action: "skip" };
		return { action: "accept" };
	};

// ---- Public API ----

/**
 * Ensure opencode.json has a `model` field. Returns the action taken.
 * - "existing": file already had a model (and it passed validation or was kept)
 * - "added": file existed but lacked model, field inserted
 * - "created": file did not exist, minimal config written
 * - "skipped": user declined the prompt in interactive mode
 *
 * Throws OpenCodeAuthRequiredError in non-interactive mode when no auth is detected
 * and no .ck.json override is set.
 */
export async function ensureOpenCodeModel(
	options: EnsureOpenCodeModelOptions,
): Promise<EnsureOpenCodeModelResult> {
	const configPath = getOpenCodeConfigPath(options);

	// --- Read existing config ---
	let existing: Record<string, unknown> | null = null;
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
			existing = parsed as Record<string, unknown>;
		} else {
			logger.warning(
				`ensureOpenCodeModel: ${configPath} is valid JSON but not an object; overwriting with default model`,
			);
		}
	} catch (err) {
		const errno = (err as NodeJS.ErrnoException | null)?.code;
		if (errno === "ENOENT") {
			// Expected when file doesn't exist yet
		} else if (err instanceof SyntaxError) {
			logger.warning(
				`ensureOpenCodeModel: ${configPath} is not valid JSON; overwriting with default model (existing contents will be lost)`,
			);
		} else {
			logger.verbose(
				`ensureOpenCodeModel: failed to read ${configPath} (${errno ?? String(err)}); recreating`,
			);
		}
	}

	// --- Existing model path ---
	if (existing !== null && typeof existing.model === "string" && existing.model.trim().length > 0) {
		const existingModel = existing.model.trim();

		// Validate existing model against catalog
		const isValid = await validateModelAgainstCatalog(existingModel, options);

		if (isValid) {
			return { path: configPath, action: "existing", model: existingModel };
		}

		// Existing model fails catalog validation
		if (!options.interactive) {
			// Non-interactive: keep as-is with loud warning
			logger.warning(
				`ensureOpenCodeModel: existing model "${existingModel}" is not found in the models.dev catalog. ` +
					`Run \`ck migrate --agent opencode\` interactively to update it, or edit ${configPath} manually.`,
			);
			return { path: configPath, action: "existing", model: existingModel };
		}

		// Interactive: offer rewrite
		const suggestion = await suggestModel(options);
		if (!suggestion.ok) {
			// No suggestion available — keep existing
			return { path: configPath, action: "existing", model: existingModel };
		}

		const invalidPrompter =
			options.prompter ??
			makeInvalidModelPrompter(existingModel, suggestion.model, suggestion.reason);
		const response = await invalidPrompter({
			suggestion: suggestion.model,
			reason: suggestion.reason,
			detectedProviders: suggestion.authedProviders,
		});

		if (response.action === "skip") {
			return { path: configPath, action: "existing", model: existingModel };
		}

		// Rewrite with suggestion
		const chosenModel = response.action === "custom" ? response.value : suggestion.model;
		const next = { ...existing, model: chosenModel };
		await mkdir(dirname(configPath), { recursive: true });
		await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
		return { path: configPath, action: "added", model: chosenModel, reason: suggestion.reason };
	}

	// --- No model configured — compute suggestion ---
	const suggestion = await suggestModel(options);

	// Non-interactive fast path
	if (!options.interactive) {
		if (!suggestion.ok) {
			// Surface the discriminated reason so the message matches reality.
			throw new OpenCodeAuthRequiredError(suggestion.failure);
		}
		const next = { ...(existing ?? {}), model: suggestion.model };
		await mkdir(dirname(configPath), { recursive: true });
		await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
		return {
			path: configPath,
			action: existing ? "added" : "created",
			model: suggestion.model,
			reason: suggestion.reason,
		};
	}

	// Interactive path — even on suggestion failure, still prompt so user can type their own.
	const prompter = options.prompter ?? clackPrompter;
	const detectedProviders = suggestion.ok ? suggestion.authedProviders : suggestion.authedProviders;
	const response = await prompter({
		suggestion: suggestion.ok ? suggestion.model : "",
		reason: suggestion.ok ? suggestion.reason : messageForReason(suggestion.failure),
		detectedProviders,
	});

	if (response.action === "skip") {
		return { path: configPath, action: "skipped", model: "", reason: "user declined" };
	}

	const chosenModel =
		response.action === "custom" ? response.value : suggestion.ok ? suggestion.model : "";

	const next = { ...(existing ?? {}), model: chosenModel };
	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");

	return {
		path: configPath,
		action: existing ? "added" : "created",
		model: chosenModel,
		reason: suggestion.ok ? suggestion.reason : undefined,
	};
}

// Re-export the auth.json reader so existing callers (and tests) can use the
// canonical implementation in opencode-model-discovery without duplicating it.
export { readAuthedProviders as detectAuthenticatedProviders };
