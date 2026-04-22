/**
 * Central model taxonomy — provider-agnostic tier mapping for portable migration.
 * Translates Claude model names (opus/sonnet/haiku) to target provider equivalents.
 */

/** Provider-agnostic capability tiers */
export type ModelTier = "heavy" | "balanced" | "light";

/** Resolved model config for a target provider */
export interface ResolvedModel {
	model: string;
	effort?: string;
}

/** Result of model resolution */
export interface ModelResolveResult {
	resolved: ResolvedModel | null;
	warning?: string;
}

/**
 * Default OpenCode model written to opencode.json when migration detects no global
 * model set. Single source of truth — update here when model versions are deprecated.
 * Users can override via .ck.json taxonomy (`opencode.default` key) without forking.
 * Ref: #728 — without a resolvable global model, OpenCode throws ProviderModelNotFoundError
 * on any agent invocation.
 */
export const OPENCODE_DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

/** Source model name → capability tier */
const SOURCE_TIER_MAP: Record<string, ModelTier> = {
	opus: "heavy",
	sonnet: "balanced",
	haiku: "light",
};

/** Default provider → tier → resolved model config */
export const DEFAULT_PROVIDER_MODEL_MAP: Record<string, Record<ModelTier, ResolvedModel>> = {
	codex: {
		heavy: { model: "gpt-5.4", effort: "xhigh" },
		balanced: { model: "gpt-5.4", effort: "high" },
		light: { model: "gpt-5.4-mini", effort: "medium" },
	},
	"gemini-cli": {
		heavy: { model: "gemini-3.1-pro-preview" },
		balanced: { model: "gemini-3.1-pro-preview" },
		light: { model: "gemini-3-flash-preview" },
	},
};

/** User taxonomy overrides from .ck.json — set once at migration start */
let userOverrides: Record<string, Record<string, ResolvedModel>> | undefined;

/** Set user taxonomy overrides from config. Call before conversion. */
export function setTaxonomyOverrides(
	overrides: Record<string, Record<string, ResolvedModel>> | undefined,
): void {
	userOverrides = overrides;
}

/**
 * Resolve the OpenCode default model, respecting .ck.json user overrides.
 * Looks for `opencode.default.model` in user overrides; otherwise returns
 * `OPENCODE_DEFAULT_MODEL`.
 */
export function resolveOpenCodeDefaultModel(): string {
	return userOverrides?.opencode?.default?.model ?? OPENCODE_DEFAULT_MODEL;
}

/** User-set opencode default model override from .ck.json, if any. */
export function getOpenCodeDefaultModelOverride(): string | undefined {
	return userOverrides?.opencode?.default?.model;
}

/**
 * Resolve a source model name to a target provider's equivalent.
 * Returns null for inherit/undefined/unmapped providers (let target use defaults).
 * Returns warning for unknown source models.
 */
export function resolveModel(
	sourceModel: string | undefined,
	targetProvider: string,
): ModelResolveResult {
	if (sourceModel === undefined || sourceModel === null) {
		return { resolved: null };
	}

	if (typeof sourceModel !== "string") {
		return {
			resolved: null,
			warning: `Ignored non-string model frontmatter (${typeof sourceModel})`,
		};
	}

	const trimmed = sourceModel.trim();
	if (!trimmed || trimmed === "inherit") {
		return { resolved: null };
	}

	const tier = SOURCE_TIER_MAP[trimmed];
	if (!tier) {
		return {
			resolved: null,
			warning: `Unknown model "${trimmed}" — not in taxonomy, commented out`,
		};
	}

	// Check user overrides first
	const overrideMap = userOverrides?.[targetProvider];
	if (overrideMap) {
		const override = overrideMap[tier];
		if (override) {
			return { resolved: override };
		}
	}

	const providerMap = DEFAULT_PROVIDER_MODEL_MAP[targetProvider];
	if (!providerMap) {
		return { resolved: null }; // Provider uses pass-through
	}

	return { resolved: providerMap[tier] };
}
