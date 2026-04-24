import { formatDisplayPath } from "../../ui/ck-cli-design/index.js";
import { getPortableBasePath, providers } from "../portable/provider-registry.js";
import type { ReconcileAction, ReconcileBanner } from "../portable/reconcile-types.js";
import type { ProviderType } from "../portable/types.js";

type PortableGroup = "agents" | "commands" | "skills" | "config" | "rules" | "hooks";

export interface PortableSourceCounts {
	agents: number;
	commands: number;
	config: number;
	hooks: number;
	rules: number;
	skills: number;
}

export interface PreflightRowData {
	count: number;
	destinations: string[];
	label: string;
	notes: string[];
}

const PORTABLE_TYPES: Array<{ key: PortableGroup; label: string }> = [
	{ key: "agents", label: "Agents" },
	{ key: "commands", label: "Commands" },
	{ key: "skills", label: "Skills" },
	{ key: "config", label: "Config" },
	{ key: "rules", label: "Rules" },
	{ key: "hooks", label: "Hooks" },
];

const MERGE_STRATEGIES = new Set(["merge-single", "yaml-merge", "json-merge"]);

export function buildPreflightRows(
	counts: PortableSourceCounts,
	selectedProviders: ProviderType[],
	options: { actualGlobal: boolean; requestedGlobal: boolean },
): PreflightRowData[] {
	return PORTABLE_TYPES.flatMap(({ key, label }) => {
		const count = counts[key];
		if (count <= 0) return [];

		const destinations = new Map<string, ProviderType[]>();
		const notes = new Set<string>();

		for (const provider of selectedProviders) {
			const config = providers[provider][key];
			if (!config) {
				notes.add(`${providers[provider].displayName}: unsupported`);
				continue;
			}

			const destination = getPortableBasePath(provider, key, { global: options.actualGlobal });
			if (!destination) {
				const note = options.actualGlobal ? "project-only" : "global-only";
				notes.add(`${providers[provider].displayName}: ${note}`);
				continue;
			}

			const normalizedDestination = formatDisplayPath(destination);
			destinations.set(normalizedDestination, [
				...(destinations.get(normalizedDestination) ?? []),
				provider,
			]);

			if (!options.requestedGlobal && config.projectPath === null && config.globalPath !== null) {
				notes.add(`${providers[provider].displayName}: global-only`);
			}
			if (options.requestedGlobal && config.globalPath === null && config.projectPath !== null) {
				notes.add(`${providers[provider].displayName}: project-only`);
			}
			if (MERGE_STRATEGIES.has(config.writeStrategy)) {
				notes.add(`${providers[provider].displayName}: merge`);
			}
		}

		for (const [destination, providersAtPath] of destinations) {
			if (providersAtPath.length > 1) {
				notes.add(
					`${providersAtPath.map((provider) => providers[provider].displayName).join(", ")} share ${destination}`,
				);
			}
		}

		return [
			{
				count,
				destinations: Array.from(destinations.keys()),
				label,
				notes: Array.from(notes),
			},
		];
	});
}

export function buildTargetSummaryLines(rows: PreflightRowData[]): string[] {
	const allDestinations = Array.from(
		new Set(
			rows.flatMap((row) => row.destinations).filter((destination) => destination.length > 0),
		),
	);
	if (allDestinations.length === 0) {
		return ["No compatible destination found for the selected providers"];
	}
	if (allDestinations.length <= 3) {
		return allDestinations;
	}
	return [...allDestinations.slice(0, 3), `+${allDestinations.length - 3} more destination(s)`];
}

export function buildProviderScopeSubtitle(
	selectedProviders: ProviderType[],
	global: boolean,
): string {
	const scope = global ? "global" : "project";
	if (selectedProviders.length === 1) {
		return `${providers[selectedProviders[0]].displayName} -> ${scope}`;
	}
	if (selectedProviders.length <= 3) {
		return `${selectedProviders.map((provider) => providers[provider].displayName).join(", ")} -> ${scope}`;
	}
	return `${selectedProviders.length} providers -> ${scope}`;
}

/**
 * Render human-readable reason for an action, preferring reasonCopy (structured)
 * over the legacy free-text reason string.
 * Used by CLI display sites that want to show the canonical EN copy.
 */
export function renderActionReason(action: ReconcileAction): string {
	return action.reasonCopy ?? action.reason;
}

/**
 * Render empty-dir banners as ASCII info boxes (design-principles.md: ASCII-only).
 * Each banner is a bordered notice informing the user of batch decisions.
 */
export function renderBannerLines(banner: ReconcileBanner): string[] {
	const width = 64;
	const bar = `+${"=".repeat(width)}+`;
	const homePath = process.env.HOME ?? "";
	const displayPath = banner.path.replace(homePath, "~");

	if (banner.kind === "empty-dir") {
		return [
			bar,
			`| [i] Detected empty ${displayPath}`,
			`|     ${banner.itemCount} item(s) below will be reinstalled.`,
			"|     Use --respect-deletions to preserve deletion.",
			bar,
		];
	}
	if (banner.kind === "empty-dir-respected") {
		return [
			bar,
			`| [i] Detected empty ${displayPath}`,
			`|     ${banner.itemCount} item(s) skipped (--respect-deletions active).`,
			bar,
		];
	}
	return [];
}

export function buildSourceSummaryLines(counts: PortableSourceCounts, origins: string[]): string[] {
	const parts: string[] = [];
	if (counts.agents > 0) parts.push(`${counts.agents} agents`);
	if (counts.skills > 0) parts.push(`${counts.skills} skills`);
	if (counts.commands > 0) parts.push(`${counts.commands} commands`);
	if (counts.rules > 0) parts.push(`${counts.rules} rules`);
	if (counts.hooks > 0) parts.push(`${counts.hooks} hooks`);
	if (counts.config > 0) parts.push("config");

	const uniqueOrigins = Array.from(new Set(origins.map((origin) => formatDisplayPath(origin))));
	const summary = parts.length > 0 ? parts.join(" · ") : "portable items detected";
	if (uniqueOrigins.length === 0) return [summary];
	return [summary, `from ${uniqueOrigins.join(" · ")}`];
}
