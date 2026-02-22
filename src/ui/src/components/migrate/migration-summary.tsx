/**
 * MigrationSummary — post-execution grouped results display
 * Groups items by portable type with collapsible sections, search, and status filters
 */

import type React from "react";
import { useDeferredValue, useMemo, useState } from "react";
import type { MigrationResults } from "../../hooks/useMigrationPlan";
import { type TranslationKey, useI18n } from "../../i18n";
import { SummaryCountPill, TypeSection } from "./migration-summary-type-section";
import {
	type StatusFilter,
	TYPE_CONFIG,
	getResultStatus,
	groupByType,
	isSingleProvider,
	sanitizeDisplayString,
} from "./migration-summary-utils";

interface MigrationSummaryProps {
	results: MigrationResults;
	onReset: () => void;
}

export const MigrationSummary: React.FC<MigrationSummaryProps> = ({ results, onReset }) => {
	const { t } = useI18n();
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearch = useDeferredValue(searchQuery);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
		() => new Set(TYPE_CONFIG.map((config) => config.key)),
	);

	const singleProvider = useMemo(() => isSingleProvider(results.results), [results.results]);
	const providerName =
		results.results[0]?.providerDisplayName || results.results[0]?.provider || "";

	const filteredResults = useMemo(() => {
		const query = deferredSearch.trim().toLowerCase();
		return results.results.filter((result) => {
			if (statusFilter !== "all" && getResultStatus(result) !== statusFilter) return false;
			if (!query) return true;
			const itemName = (result.itemName || "").toLowerCase();
			const path = (result.path || "").toLowerCase();
			const provider = (result.providerDisplayName || result.provider || "").toLowerCase();
			return itemName.includes(query) || path.includes(query) || provider.includes(query);
		});
	}, [results.results, deferredSearch, statusFilter]);

	const grouped = useMemo(() => groupByType(filteredResults), [filteredResults]);
	const visibleTypeKeys = useMemo(() => [...grouped.keys()], [grouped]);
	const totalItems = results.counts.installed + results.counts.skipped + results.counts.failed;
	const allExpanded =
		visibleTypeKeys.length > 0 && visibleTypeKeys.every((typeKey) => expandedTypes.has(typeKey));

	const toggleType = (typeKey: string) => {
		setExpandedTypes((previous) => {
			const next = new Set(previous);
			if (next.has(typeKey)) next.delete(typeKey);
			else next.add(typeKey);
			return next;
		});
	};

	const toggleAllSections = () => {
		if (allExpanded) {
			setExpandedTypes(new Set());
			return;
		}
		setExpandedTypes(new Set(visibleTypeKeys));
	};

	return (
		<div className="dash-panel p-4 md:p-5 space-y-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<h2 className="text-base font-semibold text-dash-text">
						{t("migrateSummaryTitle")}
						{singleProvider && providerName && (
							<span className="text-dash-text-muted font-normal">
								{" "}
								· {sanitizeDisplayString(providerName)}
							</span>
						)}
					</h2>
					<p className="text-xs text-dash-text-muted mt-1">
						{totalItems} {t("migrateSummarySubtitle")}
					</p>
				</div>
				<button
					type="button"
					onClick={onReset}
					className="dash-focus-ring px-4 py-2 text-sm font-semibold rounded-md bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
				>
					{t("migrateSummaryNewMigration")}
				</button>
			</div>

			<div className="flex flex-wrap items-center gap-2 text-xs">
				<SummaryCountPill
					label={t("migrateStatusInstalled")}
					count={results.counts.installed}
					className="border-green-500/30 bg-green-500/10 text-green-400"
				/>
				<SummaryCountPill
					label={t("migrateStatusSkipped")}
					count={results.counts.skipped}
					className="border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
				/>
				<SummaryCountPill
					label={t("migrateStatusFailed")}
					count={results.counts.failed}
					className="border-red-500/30 bg-red-500/10 text-red-400"
				/>
			</div>

			{results.warnings.length > 0 && (
				<div className="space-y-2">
					{results.warnings.map((warning, index) => (
						<div
							key={index}
							className="px-3 py-2 border border-yellow-500/30 bg-yellow-500/10 rounded-md text-xs text-yellow-400"
						>
							{sanitizeDisplayString(warning)}
						</div>
					))}
				</div>
			)}

			<div className="flex flex-col gap-2">
				<div className="relative">
					<svg
						className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 stroke-dash-text-muted"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						placeholder={t("migrateSummarySearchPlaceholder")}
						className="dash-focus-ring w-full pl-9 pr-3 py-2 bg-dash-bg border border-dash-border rounded-lg text-dash-text text-sm focus:border-dash-accent transition-colors"
					/>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					{(["all", "installed", "skipped", "failed"] as StatusFilter[]).map((filter) => {
						const labelKey: TranslationKey =
							filter === "all"
								? "migrateSummaryFilterAll"
								: filter === "installed"
									? "migrateStatusInstalled"
									: filter === "skipped"
										? "migrateStatusSkipped"
										: "migrateStatusFailed";

						return (
							<button
								key={filter}
								type="button"
								onClick={() => setStatusFilter(filter)}
								className={`dash-focus-ring px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
									statusFilter === filter
										? "bg-dash-accent/10 border-dash-accent text-dash-accent"
										: "border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
								}`}
							>
								{t(labelKey)}
							</button>
						);
					})}

					<button
						type="button"
						onClick={toggleAllSections}
						className="dash-focus-ring ml-1 px-3 py-1 text-xs font-medium rounded-md border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
					>
						{allExpanded ? t("migrateSummaryCollapseAll") : t("migrateSummaryExpandAll")}
					</button>
				</div>
			</div>

			{filteredResults.length === 0 ? (
				<div className="text-center py-8 text-sm text-dash-text-muted">
					{t("migrateSummaryNoResults")}
				</div>
			) : (
				<div className="space-y-2.5">
					{TYPE_CONFIG.map((config) => {
						const items = grouped.get(config.key);
						if (!items || items.length === 0) return null;
						return (
							<TypeSection
								key={config.key}
								typeKey={config.key}
								labelKey={config.labelKey}
								badgeClass={config.badgeClass}
								items={items}
								isExpanded={expandedTypes.has(config.key)}
								onToggle={() => toggleType(config.key)}
								singleProvider={singleProvider}
							/>
						);
					})}

					{(() => {
						const unknownItems = grouped.get("unknown");
						if (!unknownItems || unknownItems.length === 0) return null;

						return (
							<TypeSection
								typeKey="unknown"
								labelKey="migrateTypeUnknown"
								badgeClass="border-dash-border text-dash-text-muted"
								items={unknownItems}
								isExpanded={expandedTypes.has("unknown")}
								onToggle={() => toggleType("unknown")}
								singleProvider={singleProvider}
							/>
						);
					})()}
				</div>
			)}
		</div>
	);
};
