/**
 * MigrationSummary — post-execution grouped results display
 * Groups items by portable type with collapsible sections, search, and smart columns
 */

import type { MigrationResultEntry } from "@/types";
import type React from "react";
import { useDeferredValue, useMemo, useState } from "react";
import type { MigrationResults } from "../../hooks/useMigrationPlan";
import { type TranslationKey, useI18n } from "../../i18n";

interface MigrationSummaryProps {
	results: MigrationResults;
	onReset: () => void;
}

type StatusFilter = "all" | "installed" | "skipped" | "failed";

/** Portable type display order and i18n key mapping */
const TYPE_CONFIG: Array<{
	key: string;
	labelKey: TranslationKey;
	color: string;
	badgeBg: string;
}> = [
	{
		key: "agent",
		labelKey: "migrateTypeAgents",
		color: "text-blue-400",
		badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
	},
	{
		key: "command",
		labelKey: "migrateTypeCommands",
		color: "text-amber-400",
		badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
	},
	{
		key: "skill",
		labelKey: "migrateTypeSkills",
		color: "text-purple-400",
		badgeBg: "bg-purple-500/15 border-purple-500/30 text-purple-400",
	},
	{
		key: "config",
		labelKey: "migrateTypeConfig",
		color: "text-teal-400",
		badgeBg: "bg-teal-500/15 border-teal-500/30 text-teal-400",
	},
	{
		key: "rules",
		labelKey: "migrateTypeRules",
		color: "text-rose-400",
		badgeBg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
	},
];

function isDisallowedControlCode(codePoint: number): boolean {
	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f)
	);
}

function sanitizeDisplayString(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

/** Shorten absolute path to relative from provider config dir */
function shortenPath(fullPath: string): string {
	if (!fullPath) return "-";
	const normalized = fullPath.replace(/\\/g, "/");
	// Match the last dotdir segment (e.g. .codex/, .claude/, .cursor/)
	const dotDirMatch = normalized.match(/.*\/(\.[^/]+\/)/);
	if (dotDirMatch?.[1]) {
		const idx = (dotDirMatch.index ?? 0) + dotDirMatch[0].length - dotDirMatch[1].length;
		return normalized.slice(idx);
	}
	// Fallback: show last 3 segments
	const segments = normalized.split("/");
	if (segments.length > 3) {
		return `.../${segments.slice(-3).join("/")}`;
	}
	return fullPath;
}

function getResultStatus(result: MigrationResultEntry): StatusFilter {
	if (!result.success) return "failed";
	if (result.skipped) return "skipped";
	return "installed";
}

function getStatusDisplay(
	status: StatusFilter,
	t: (key: TranslationKey) => string,
): { label: string; className: string } {
	switch (status) {
		case "failed":
			return { label: t("migrateStatusFailed"), className: "text-red-400" };
		case "skipped":
			return {
				label: t("migrateStatusSkipped"),
				className: "text-yellow-400",
			};
		default:
			return {
				label: t("migrateStatusInstalled"),
				className: "text-green-400",
			};
	}
}

/** Group results by portable type */
function groupByType(results: MigrationResultEntry[]): Map<string, MigrationResultEntry[]> {
	const groups = new Map<string, MigrationResultEntry[]>();
	for (const result of results) {
		const type = result.portableType || "unknown";
		const group = groups.get(type) || [];
		group.push(result);
		groups.set(type, group);
	}
	return groups;
}

/** Check if all results have the same provider */
function isSingleProvider(results: MigrationResultEntry[]): boolean {
	if (results.length === 0) return true;
	const firstProvider = results[0].provider;
	return results.every((r) => r.provider === firstProvider);
}

/** Collapsible section for a portable type group */
const TypeSection: React.FC<{
	typeKey: string;
	labelKey: TranslationKey;
	color: string;
	badgeBg: string;
	items: MigrationResultEntry[];
	isExpanded: boolean;
	onToggle: () => void;
	singleProvider: boolean;
}> = ({ typeKey, labelKey, color, badgeBg, items, isExpanded, onToggle, singleProvider }) => {
	const { t } = useI18n();
	const installedCount = items.filter((r) => r.success && !r.skipped).length;
	const skippedCount = items.filter((r) => r.skipped).length;
	const failedCount = items.filter((r) => !r.success).length;
	const allOk = failedCount === 0 && skippedCount === 0;

	return (
		<div className="border border-dash-border rounded-lg overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-3 px-4 py-2.5 bg-dash-bg/60 hover:bg-dash-bg transition-colors text-left"
			>
				<svg
					className={`w-3.5 h-3.5 text-dash-text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path d="M9 5l7 7-7 7" />
				</svg>

				<span className={`text-sm font-semibold ${color}`}>{t(labelKey)}</span>

				<span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}`}>
					{items.length}
				</span>

				<span className="flex-1" />

				{allOk ? (
					<span className="text-[10px] uppercase tracking-wide text-green-400">
						{installedCount} {t("migrateStatusInstalled").toLowerCase()}
					</span>
				) : (
					<span className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
						{installedCount > 0 && <span className="text-green-400">{installedCount} ok</span>}
						{skippedCount > 0 && <span className="text-yellow-400">{skippedCount} skip</span>}
						{failedCount > 0 && <span className="text-red-400">{failedCount} fail</span>}
					</span>
				)}
			</button>

			{isExpanded && (
				<div className="divide-y divide-dash-border/50">
					{items.map((result, index) => {
						const status = getResultStatus(result);
						const statusDisplay = getStatusDisplay(status, t);
						const itemName = result.itemName || shortenPath(result.path);
						const shortPath = shortenPath(result.path);

						return (
							<div
								key={`${typeKey}-${result.provider}-${result.path}-${index}`}
								className="flex items-center gap-3 px-4 py-2 text-xs hover:bg-dash-bg/30"
							>
								<span className="font-medium text-dash-text min-w-0 truncate flex-shrink-0 max-w-[200px]">
									{sanitizeDisplayString(itemName)}
								</span>

								{!singleProvider && (
									<span className="text-dash-text-muted flex-shrink-0">
										{sanitizeDisplayString(result.providerDisplayName || result.provider)}
									</span>
								)}

								<span
									className="text-dash-text-muted font-mono text-[10px] truncate flex-1 min-w-0"
									title={sanitizeDisplayString(result.path || "")}
								>
									{sanitizeDisplayString(shortPath)}
								</span>

								<span className={`flex-shrink-0 font-medium ${statusDisplay.className}`}>
									{statusDisplay.label}
								</span>

								{(() => {
									const errorText = sanitizeDisplayString(result.error || result.skipReason || "");
									if (!errorText) return null;
									return (
										<span className="text-red-400/80 truncate max-w-[180px]" title={errorText}>
											{errorText}
										</span>
									);
								})()}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export const MigrationSummary: React.FC<MigrationSummaryProps> = ({ results, onReset }) => {
	const { t } = useI18n();
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearch = useDeferredValue(searchQuery);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
		() => new Set(TYPE_CONFIG.map((tc) => tc.key)),
	);

	const singleProvider = useMemo(() => isSingleProvider(results.results), [results.results]);
	const providerName =
		results.results[0]?.providerDisplayName || results.results[0]?.provider || "";

	// Filter results by search + status
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

	// Group filtered results by type
	const grouped = useMemo(() => groupByType(filteredResults), [filteredResults]);

	// Per-type discovery breakdown (from backend or computed from results)
	const typeBreakdown = useMemo(() => {
		if (results.discovery) return results.discovery;
		const counts = {
			agents: 0,
			commands: 0,
			skills: 0,
			config: 0,
			rules: 0,
		};
		for (const result of results.results) {
			const type = result.portableType;
			if (type === "agent") counts.agents++;
			else if (type === "command") counts.commands++;
			else if (type === "skill") counts.skills++;
			else if (type === "config") counts.config++;
			else if (type === "rules") counts.rules++;
		}
		return counts;
	}, [results]);

	const toggleType = (typeKey: string) => {
		setExpandedTypes((prev) => {
			const next = new Set(prev);
			if (next.has(typeKey)) next.delete(typeKey);
			else next.add(typeKey);
			return next;
		});
	};

	const visibleTypeKeys = useMemo(() => [...grouped.keys()], [grouped]);

	const toggleAllSections = () => {
		const allExpanded = visibleTypeKeys.every((key) => expandedTypes.has(key));
		if (allExpanded) {
			setExpandedTypes(new Set());
		} else {
			setExpandedTypes(new Set([...visibleTypeKeys, "unknown"]));
		}
	};

	const allExpanded =
		visibleTypeKeys.length > 0 && visibleTypeKeys.every((key) => expandedTypes.has(key));
	const totalItems = results.counts.installed + results.counts.skipped + results.counts.failed;

	return (
		<div className="space-y-4">
			<div className="dash-panel p-5">
				{/* Header */}
				<div className="flex items-center justify-between mb-4">
					<div>
						<h2 className="text-lg font-semibold text-dash-text">
							{t("migrateSummaryTitle")}
							{singleProvider && providerName && (
								<span className="text-dash-text-muted font-normal">
									{" "}
									— {sanitizeDisplayString(providerName)}
								</span>
							)}
						</h2>
						<p className="text-xs text-dash-text-muted mt-0.5">
							{totalItems} {t("migrateSummarySubtitle")}
						</p>
					</div>
					<button
						type="button"
						onClick={onReset}
						className="dash-focus-ring px-4 py-2 text-sm font-medium rounded-md bg-dash-bg border border-dash-border text-dash-text-secondary hover:bg-dash-surface-hover"
					>
						{t("migrateSummaryNewMigration")}
					</button>
				</div>

				{/* Per-type breakdown stats */}
				<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
					{TYPE_CONFIG.map((tc) => {
						const countKey =
							tc.key === "agent"
								? "agents"
								: tc.key === "command"
									? "commands"
									: tc.key === "skill"
										? "skills"
										: tc.key;
						const count = typeBreakdown[countKey as keyof typeof typeBreakdown] ?? 0;
						return (
							<div
								key={tc.key}
								className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md text-center"
							>
								<p className="text-[10px] uppercase tracking-wide text-dash-text-muted">
									{t(tc.labelKey)}
								</p>
								<p className={`text-lg font-semibold mt-0.5 ${tc.color}`}>{count}</p>
							</div>
						);
					})}
				</div>

				{/* Status summary cards */}
				<div className="grid grid-cols-3 gap-2 mb-4">
					<div className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md text-center">
						<p className="text-[10px] uppercase tracking-wide text-dash-text-muted">
							{t("migrateInstalled")}
						</p>
						<p className="text-xl font-semibold text-green-400 mt-0.5">
							{results.counts.installed}
						</p>
					</div>
					<div className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md text-center">
						<p className="text-[10px] uppercase tracking-wide text-dash-text-muted">
							{t("migrateSkipped")}
						</p>
						<p className="text-xl font-semibold text-yellow-400 mt-0.5">{results.counts.skipped}</p>
					</div>
					<div className="px-3 py-2 bg-dash-bg border border-dash-border rounded-md text-center">
						<p className="text-[10px] uppercase tracking-wide text-dash-text-muted">
							{t("migrateFailed")}
						</p>
						<p className="text-xl font-semibold text-red-400 mt-0.5">{results.counts.failed}</p>
					</div>
				</div>

				{/* Warnings */}
				{results.warnings.length > 0 && (
					<div className="mb-4 space-y-2">
						{results.warnings.map((warning, index) => (
							<div
								key={index}
								className="px-3 py-2 border border-yellow-500/30 bg-yellow-500/10 rounded text-xs text-yellow-400"
							>
								{sanitizeDisplayString(warning)}
							</div>
						))}
					</div>
				)}

				{/* Search + filter bar */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-4">
					<div className="relative flex-1">
						<svg
							className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 stroke-dash-text-muted"
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
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={t("migrateSummarySearchPlaceholder")}
							className="dash-focus-ring w-full pl-8 pr-3 py-1.5 bg-dash-bg border border-dash-border rounded-md text-dash-text text-xs focus:border-dash-accent transition-colors"
						/>
					</div>

					<div className="flex items-center gap-1.5">
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
									className={`dash-focus-ring px-2.5 py-1 text-[10px] uppercase tracking-wide rounded-md border transition-colors ${
										statusFilter === filter
											? "bg-dash-accent/10 border-dash-accent text-dash-accent"
											: "border-dash-border text-dash-text-muted hover:bg-dash-surface-hover"
									}`}
								>
									{t(labelKey)}
								</button>
							);
						})}

						<button
							type="button"
							onClick={toggleAllSections}
							className="dash-focus-ring px-2.5 py-1 text-[10px] text-dash-text-muted border border-dash-border rounded-md hover:bg-dash-surface-hover ml-1"
						>
							{allExpanded ? t("migrateSummaryCollapseAll") : t("migrateSummaryExpandAll")}
						</button>
					</div>
				</div>

				{/* Grouped sections */}
				{filteredResults.length === 0 ? (
					<div className="text-center py-8 text-sm text-dash-text-muted">
						{t("migrateSummaryNoResults")}
					</div>
				) : (
					<div className="space-y-2">
						{TYPE_CONFIG.map((tc) => {
							const items = grouped.get(tc.key);
							if (!items || items.length === 0) return null;
							return (
								<TypeSection
									key={tc.key}
									typeKey={tc.key}
									labelKey={tc.labelKey}
									color={tc.color}
									badgeBg={tc.badgeBg}
									items={items}
									isExpanded={expandedTypes.has(tc.key)}
									onToggle={() => toggleType(tc.key)}
									singleProvider={singleProvider}
								/>
							);
						})}

						{/* Catch untyped results */}
						{(() => {
							const unknownItems = grouped.get("unknown");
							if (!unknownItems) return null;
							return (
								<TypeSection
									typeKey="unknown"
									labelKey="migrateTypeUnknown"
									color="text-dash-text-muted"
									badgeBg="bg-dash-bg border-dash-border text-dash-text-muted"
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
		</div>
	);
};
