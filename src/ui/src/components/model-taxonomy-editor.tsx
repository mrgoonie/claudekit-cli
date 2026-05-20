/**
 * ModelTaxonomyEditor - Collapsible editor for provider→tier→model taxonomy overrides
 * Matches SchemaSection styling. Collapsed by default.
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../i18n";

// Hardcoded defaults — keep in sync with src/commands/portable/model-taxonomy.ts
// UI is a separate Vite build and cannot import from src/commands/ directly
const TAXONOMY_DEFAULTS: Record<string, Record<string, { model: string; effort?: string }>> = {
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

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	codex: "Codex",
	"gemini-cli": "Gemini CLI",
};

const TIER_KEYS = ["heavy", "balanced", "light"] as const;
type TierKey = (typeof TIER_KEYS)[number];

interface ModelTaxonomyEditorProps {
	config: Record<string, unknown>;
	onChange: (path: string, value: unknown) => void;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	return path.split(".").reduce((acc: unknown, key: string) => {
		if (acc !== null && acc !== undefined && typeof acc === "object" && key in acc) {
			return (acc as Record<string, unknown>)[key];
		}
		return undefined;
	}, obj as unknown);
}

const INPUT_CLASS =
	"bg-transparent border border-dash-border rounded px-2 py-1 text-sm text-dash-text placeholder:text-dash-text-muted focus:border-dash-accent focus:outline-none w-full";

const ModelTaxonomyEditor: React.FC<ModelTaxonomyEditorProps> = ({ config, onChange }) => {
	const { t } = useI18n();
	const [isCollapsed, setIsCollapsed] = useState(false);

	const handleModelChange = (
		provider: string,
		tier: TierKey,
		field: "model" | "effort",
		value: string,
	) => {
		const path = `modelTaxonomy.${provider}.${tier}.${field}`;
		onChange(path, value === "" ? undefined : value);
	};

	const handleResetProvider = (provider: string) => {
		for (const tier of TIER_KEYS) {
			onChange(`modelTaxonomy.${provider}.${tier}.model`, undefined);
			if (TAXONOMY_DEFAULTS[provider]?.[tier]?.effort !== undefined) {
				onChange(`modelTaxonomy.${provider}.${tier}.effort`, undefined);
			}
		}
	};

	const getTierLabel = (tier: TierKey): string => {
		if (tier === "heavy") return t("taxonomyTierHeavy");
		if (tier === "balanced") return t("taxonomyTierBalanced");
		return t("taxonomyTierLight");
	};

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg overflow-hidden flex flex-col h-full">
			{/* Section header */}
			<button
				type="button"
				onClick={() => setIsCollapsed(!isCollapsed)}
				className="w-full flex items-center justify-between px-4 py-3 bg-dash-surface-hover/30 hover:bg-dash-surface-hover/50 transition-colors"
				aria-expanded={!isCollapsed}
				aria-controls="section-model-taxonomy"
			>
				<h3 className="text-sm font-bold text-dash-text uppercase tracking-wider">
					{t("sectionModelTaxonomy")}
				</h3>
				<svg
					className={`w-4 h-4 text-dash-text-muted transition-transform duration-200 ${
						isCollapsed ? "" : "rotate-180"
					}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{/* Section content */}
			{!isCollapsed && (
				<div id="section-model-taxonomy" className="flex-1 overflow-y-auto min-h-0">
					<div className="px-4 py-3 space-y-4">
						<p className="text-xs text-dash-text-secondary">{t("taxonomyDescription")}</p>

						{Object.entries(TAXONOMY_DEFAULTS).map(([provider, tiers]) => {
							const hasEffort = Object.values(tiers).some((d) => d.effort !== undefined);

							return (
								<div key={provider} className="space-y-2">
									{/* Provider heading */}
									<div className="flex items-center justify-between">
										<span className="text-xs font-semibold text-dash-text uppercase tracking-wider">
											{PROVIDER_DISPLAY_NAMES[provider] ?? provider}
										</span>
										<button
											type="button"
											onClick={() => handleResetProvider(provider)}
											className="text-xs text-dash-text-muted hover:text-dash-text px-2 py-0.5 rounded border border-dash-border hover:border-dash-accent transition-colors"
										>
											{t("taxonomyResetProvider")}
										</button>
									</div>

									{/* Table */}
									<div className="overflow-hidden rounded border border-dash-border">
										<table className="w-full text-xs">
											<thead>
												<tr className="bg-dash-surface-hover/40 border-b border-dash-border">
													<th className="text-left px-3 py-2 text-dash-text-secondary font-medium w-1/4">
														{t("taxonomyTier")}
													</th>
													<th className="text-left px-3 py-2 text-dash-text-secondary font-medium">
														{t("taxonomyModel")}
													</th>
													{hasEffort && (
														<th className="text-left px-3 py-2 text-dash-text-secondary font-medium w-1/4">
															{t("taxonomyEffort")}
														</th>
													)}
												</tr>
											</thead>
											<tbody>
												{TIER_KEYS.map((tier) => {
													const defaults = tiers[tier];
													const modelVal = getNestedValue(
														config,
														`modelTaxonomy.${provider}.${tier}.model`,
													) as string | undefined;
													const effortVal = getNestedValue(
														config,
														`modelTaxonomy.${provider}.${tier}.effort`,
													) as string | undefined;

													return (
														<tr key={tier} className="border-b border-dash-border last:border-0">
															<td className="px-3 py-2 text-dash-text-secondary">
																{getTierLabel(tier)}
															</td>
															<td className="px-3 py-2">
																<input
																	type="text"
																	className={INPUT_CLASS}
																	placeholder={defaults?.model ?? ""}
																	value={modelVal ?? ""}
																	onChange={(e) =>
																		handleModelChange(provider, tier, "model", e.target.value)
																	}
																/>
															</td>
															{hasEffort && (
																<td className="px-3 py-2">
																	{defaults?.effort !== undefined ? (
																		<input
																			type="text"
																			className={INPUT_CLASS}
																			placeholder={defaults.effort}
																			value={effortVal ?? ""}
																			onChange={(e) =>
																				handleModelChange(provider, tier, "effort", e.target.value)
																			}
																		/>
																	) : null}
																</td>
															)}
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};

export default ModelTaxonomyEditor;
