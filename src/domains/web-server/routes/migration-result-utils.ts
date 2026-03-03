/**
 * Pure utility functions for migration result processing.
 * Extracted from migration-routes.ts for testability (#450).
 */

import type { ProviderPathCollision } from "@/commands/portable/provider-registry.js";
import { providers } from "@/commands/portable/provider-registry.js";
import type { PortableInstallResult, PortableType } from "@/commands/portable/types.js";

export interface DiscoveryCounts {
	agents: number;
	commands: number;
	skills: number;
	config: number;
	rules: number;
	hooks: number;
	/**
	 * Per-provider raw operation counts for ownership traceability.
	 * Unlike top-level counts (which deduplicate by itemName), these reflect
	 * actual operations per provider — intentionally not deduplicated.
	 */
	providerBreakdown: Record<string, { total: number; types: Record<string, number> }>;
}

/**
 * Count unique items per portable type from install results,
 * plus per-provider operation breakdown for ownership traceability.
 */
export function toDiscoveryCounts(results: PortableInstallResult[]): DiscoveryCounts {
	const sets = {
		agents: new Set<string>(),
		commands: new Set<string>(),
		skills: new Set<string>(),
		config: new Set<string>(),
		rules: new Set<string>(),
		hooks: new Set<string>(),
	};
	const providerCounts = new Map<string, { total: number; types: Record<string, number> }>();
	for (const result of results) {
		const itemKey = result.itemName || result.path || `${result.provider}`;
		if (result.portableType === "agent") sets.agents.add(itemKey);
		else if (result.portableType === "command") sets.commands.add(itemKey);
		else if (result.portableType === "skill") sets.skills.add(itemKey);
		else if (result.portableType === "config") sets.config.add(itemKey);
		else if (result.portableType === "rules") sets.rules.add(itemKey);
		else if (result.portableType === "hooks") sets.hooks.add(itemKey);

		const provider = result.provider;
		const entry = providerCounts.get(provider) || { total: 0, types: {} };
		entry.total += 1;
		const typeKey = result.portableType || "unknown";
		entry.types[typeKey] = (entry.types[typeKey] || 0) + 1;
		providerCounts.set(provider, entry);
	}
	return {
		agents: sets.agents.size,
		commands: sets.commands.size,
		skills: sets.skills.size,
		config: sets.config.size,
		rules: sets.rules.size,
		hooks: sets.hooks.size,
		providerBreakdown: Object.fromEntries(providerCounts),
	};
}

/** Return zero-state discovery counts — use at early-return sites for type-safe responses. */
export function emptyDiscoveryCounts(): DiscoveryCounts {
	return {
		agents: 0,
		commands: 0,
		skills: 0,
		config: 0,
		rules: 0,
		hooks: 0,
		providerBreakdown: {},
	};
}

/**
 * Annotate install results with collision info — marks each result with other
 * providers that share the same target path, so the UI can surface ownership.
 *
 * Each collision carries a `global` flag and a `path`. Results are matched by
 * checking that the result's install path starts with the collision path, so
 * global-scope collisions never annotate project-scope results (and vice versa).
 *
 * @param results - mutated in place; `collidingProviders` and `warnings` are merged additively.
 */
export function annotateResultsWithCollisions(
	results: PortableInstallResult[],
	collisions: ProviderPathCollision[],
): void {
	if (collisions.length === 0) return;

	// Map ProviderConfig keys (plural) to PortableType values (singular).
	// Uses `satisfies` so adding a new portable type without updating this map causes a compile error.
	const typeMap = {
		agents: "agent",
		commands: "command",
		skills: "skill",
		config: "config",
		rules: "rules",
		hooks: "hooks",
	} satisfies Record<"agents" | "commands" | "skills" | "config" | "rules" | "hooks", PortableType>;

	for (const collision of collisions) {
		const resultType = typeMap[collision.portableType];
		for (const result of results) {
			if (result.portableType !== resultType) continue;
			if (!collision.providers.includes(result.provider)) continue;
			// Scope guard: only annotate results whose install path falls under the collision path.
			// This prevents global-scope collisions from annotating project-scope results.
			if (result.path && collision.path && !result.path.startsWith(collision.path)) continue;

			const others = collision.providers.filter((p) => p !== result.provider);
			if (others.length > 0) {
				// Merge with existing collisions (idempotent across repeated calls)
				const merged = new Set(result.collidingProviders ?? []);
				for (const p of others) merged.add(p);
				result.collidingProviders = [...merged];

				const otherNames = others.map((p) => providers[p]?.displayName || p);
				const warning = `Path "${collision.path}" is shared with: ${otherNames.join(", ")}`;
				result.warnings = result.warnings || [];
				if (!result.warnings.includes(warning)) {
					result.warnings.push(warning);
				}
			}
		}
	}
}
