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

/** Source model name → capability tier */
const SOURCE_TIER_MAP: Record<string, ModelTier> = {
	opus: "heavy",
	sonnet: "balanced",
	haiku: "light",
};

/** Provider → tier → resolved model config */
const PROVIDER_MODEL_MAP: Record<string, Record<ModelTier, ResolvedModel>> = {
	codex: {
		heavy: { model: "gpt-5.4", effort: "xhigh" },
		balanced: { model: "gpt-5.4", effort: "high" },
		light: { model: "gpt-5.4-mini", effort: "medium" },
	},
	"github-copilot": {
		heavy: { model: "gpt-4o" },
		balanced: { model: "gpt-4o-mini" },
		light: { model: "gpt-4o-mini" },
	},
};

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

	const providerMap = PROVIDER_MODEL_MAP[targetProvider];
	if (!providerMap) {
		return { resolved: null }; // Provider uses pass-through
	}

	return { resolved: providerMap[tier] };
}
