/**
 * Health status summary cards - one per check group
 */
import type React from "react";
import { useI18n } from "../../i18n";
import type { CheckSummaryResponse } from "../../services/api";

interface HealthStatusCardsProps {
	summary: CheckSummaryResponse;
	selectedGroup: string | null;
	onSelectGroup: (group: string | null) => void;
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
	system: (
		<svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<rect x="2" y="3" width="20" height="14" rx="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</svg>
	),
	claudekit: (
		<svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<path d="M12 2L2 7l10 5 10-5-10-5z" />
			<path d="M2 17l10 5 10-5" />
			<path d="M2 12l10 5 10-5" />
		</svg>
	),
	auth: (
		<svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<rect x="3" y="11" width="18" height="11" rx="2" />
			<path d="M7 11V7a5 5 0 0110 0v4" />
		</svg>
	),
	platform: (
		<svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
		</svg>
	),
	network: (
		<svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<circle cx="12" cy="12" r="10" />
			<line x1="2" y1="12" x2="22" y2="12" />
			<path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
		</svg>
	),
};

const GROUPS = ["system", "claudekit", "auth", "platform", "network"] as const;

function getGroupStats(summary: CheckSummaryResponse, group: string) {
	const checks = summary.checks.filter((c) => c.group === group);
	const passed = checks.filter((c) => c.status === "pass").length;
	const warnings = checks.filter((c) => c.status === "warn").length;
	const failed = checks.filter((c) => c.status === "fail").length;
	return { total: checks.length, passed, warnings, failed };
}

function getGroupColor(stats: { failed: number; warnings: number }) {
	if (stats.failed > 0) return "text-red-500";
	if (stats.warnings > 0) return "text-amber-500";
	return "text-emerald-500";
}

function getGroupBorderColor(stats: { failed: number; warnings: number }) {
	if (stats.failed > 0) return "border-red-500/30";
	if (stats.warnings > 0) return "border-amber-500/30";
	return "border-emerald-500/30";
}

const HealthStatusCards: React.FC<HealthStatusCardsProps> = ({
	summary,
	selectedGroup,
	onSelectGroup,
}) => {
	const { t } = useI18n();

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
			{GROUPS.map((group) => {
				const stats = getGroupStats(summary, group);
				const isSelected = selectedGroup === group;
				const color = getGroupColor(stats);
				const borderColor = getGroupBorderColor(stats);

				return (
					<button
						key={group}
						type="button"
						onClick={() => onSelectGroup(isSelected ? null : group)}
						className={`p-4 rounded-lg border transition-all text-left ${
							isSelected
								? `${borderColor} bg-dash-surface-hover`
								: "border-dash-border bg-dash-surface hover:bg-dash-surface-hover"
						}`}
					>
						<div className="flex items-center gap-2 mb-2">
							<span className={color}>{GROUP_ICONS[group]}</span>
							<span className="text-xs font-semibold text-dash-text uppercase tracking-wide">
								{t(`healthGroup_${group}` as keyof typeof t)}
							</span>
						</div>
						<div className="flex items-baseline gap-1.5">
							<span className={`text-2xl font-bold ${color}`}>
								{stats.passed}/{stats.total}
							</span>
						</div>
						{(stats.failed > 0 || stats.warnings > 0) && (
							<div className="flex gap-2 mt-1.5 text-[11px]">
								{stats.failed > 0 && (
									<span className="text-red-500">
										{stats.failed} {t("healthFailed")}
									</span>
								)}
								{stats.warnings > 0 && (
									<span className="text-amber-500">
										{stats.warnings} {t("healthWarnings")}
									</span>
								)}
							</div>
						)}
					</button>
				);
			})}
		</div>
	);
};

export default HealthStatusCards;
