import type { MigrationResultEntry } from "@/types";
import type React from "react";
import { type TranslationKey, useI18n } from "../../i18n";
import {
	getResultStatus,
	getStatusDisplay,
	sanitizeDisplayString,
	shortenPath,
} from "./migration-summary-utils";

interface SummaryCountPillProps {
	label: string;
	count: number;
	className: string;
}

export const SummaryCountPill: React.FC<SummaryCountPillProps> = ({ label, count, className }) => {
	if (count <= 0) return null;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${className}`}
		>
			<span className="font-semibold">{count}</span>
			<span>{label}</span>
		</span>
	);
};

interface TypeSectionProps {
	typeKey: string;
	labelKey: TranslationKey;
	badgeClass: string;
	items: MigrationResultEntry[];
	isExpanded: boolean;
	onToggle: () => void;
	singleProvider: boolean;
}

export const TypeSection: React.FC<TypeSectionProps> = ({
	typeKey,
	labelKey,
	badgeClass,
	items,
	isExpanded,
	onToggle,
	singleProvider,
}) => {
	const { t } = useI18n();
	const installedCount = items.filter((entry) => getResultStatus(entry) === "installed").length;
	const skippedCount = items.filter((entry) => getResultStatus(entry) === "skipped").length;
	const failedCount = items.filter((entry) => getResultStatus(entry) === "failed").length;
	const gridColumnsClass = singleProvider
		? "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.35fr)_auto_minmax(0,1fr)]"
		: "md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto_minmax(0,1fr)]";

	return (
		<div className="rounded-xl border border-dash-border bg-dash-surface overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-dash-surface-hover transition-colors"
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

				<p className="text-sm font-semibold text-dash-text">{t(labelKey)}</p>
				<span
					className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
				>
					{items.length}
				</span>

				<span className="hidden sm:block flex-1" />
				<div className="flex flex-wrap items-center gap-1.5 text-[11px]">
					<SummaryCountPill
						label={t("migrateStatusInstalled")}
						count={installedCount}
						className="border-green-500/30 bg-green-500/10 text-green-400"
					/>
					<SummaryCountPill
						label={t("migrateStatusSkipped")}
						count={skippedCount}
						className="border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
					/>
					<SummaryCountPill
						label={t("migrateStatusFailed")}
						count={failedCount}
						className="border-red-500/30 bg-red-500/10 text-red-400"
					/>
				</div>
			</button>

			{isExpanded && (
				<div className="border-t border-dash-border/80">
					<div
						className={`hidden md:grid ${gridColumnsClass} items-center gap-3 px-4 py-2 border-b border-dash-border/70 text-[10px] font-semibold uppercase tracking-wide text-dash-text-muted`}
					>
						<p>{t("migrateItem")}</p>
						{!singleProvider && <p>{t("migrateProvider")}</p>}
						<p>{t("migratePath")}</p>
						<p>{t("migrateStatus")}</p>
						<p>{t("migrateError")}</p>
					</div>

					<div className="divide-y divide-dash-border/70">
						{items.map((result, index) => {
							const status = getResultStatus(result);
							const statusDisplay = getStatusDisplay(status, t);
							const itemName = sanitizeDisplayString(result.itemName || shortenPath(result.path));
							const providerName = sanitizeDisplayString(
								result.providerDisplayName || result.provider || "",
							);
							const fullPath = sanitizeDisplayString(result.path || "");
							const shortPath = sanitizeDisplayString(shortenPath(result.path));
							const errorText = sanitizeDisplayString(result.error || result.skipReason || "");

							return (
								<div
									key={`${typeKey}-${result.provider}-${result.path}-${index}`}
									className={`grid gap-1.5 ${gridColumnsClass} items-start px-4 py-2.5 hover:bg-dash-bg/60 transition-colors`}
								>
									<div className="min-w-0">
										<p className="text-xs font-semibold text-dash-text truncate" title={itemName}>
											{itemName}
										</p>
										<div className="mt-0.5 space-y-0.5 md:hidden">
											{!singleProvider && (
												<p className="text-[11px] text-dash-text-secondary truncate">
													{providerName}
												</p>
											)}
											<p
												className="font-mono text-[11px] text-dash-text-muted truncate"
												title={fullPath}
											>
												{shortPath}
											</p>
											{errorText && (
												<p className="text-[11px] text-red-400/80 line-clamp-2" title={errorText}>
													{errorText}
												</p>
											)}
										</div>
									</div>

									{!singleProvider && (
										<p className="hidden md:block text-[11px] text-dash-text-secondary truncate">
											{providerName}
										</p>
									)}

									<p
										className="hidden md:block font-mono text-[11px] text-dash-text-muted truncate"
										title={fullPath}
									>
										{shortPath}
									</p>

									<span
										className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusDisplay.className}`}
									>
										{statusDisplay.label}
									</span>

									<p
										className={`hidden md:block text-[11px] truncate ${errorText ? "text-red-400/80" : "text-dash-text-muted"}`}
										title={errorText}
									>
										{errorText || "-"}
									</p>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
};
