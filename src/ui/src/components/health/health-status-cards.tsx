/**
 * Health status summary cards - one per check group with progress bars
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
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<rect x="2" y="3" width="20" height="14" rx="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</svg>
	),
	claudekit: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<path d="M12 2L2 7l10 5 10-5-10-5z" />
			<path d="M2 17l10 5 10-5" />
			<path d="M2 12l10 5 10-5" />
		</svg>
	),
	auth: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<rect x="3" y="11" width="18" height="11" rx="2" />
			<path d="M7 11V7a5 5 0 0110 0v4" />
		</svg>
	),
	platform: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
		</svg>
	),
	network: (
		<svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
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

function getStatusColor(stats: { failed: number; warnings: number }) {
	if (stats.failed > 0) return { text: "text-red-500", bar: "bg-red-500", ring: "ring-red-500/20" };
	if (stats.warnings > 0)
		return { text: "text-amber-500", bar: "bg-amber-500", ring: "ring-amber-500/20" };
	return { text: "text-emerald-500", bar: "bg-emerald-500", ring: "ring-emerald-500/20" };
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
				if (stats.total === 0) return null;
				const isSelected = selectedGroup === group;
				const colors = getStatusColor(stats);
				const pct = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;

				return (
					<button
						key={group}
						type="button"
						onClick={() => onSelectGroup(isSelected ? null : group)}
						className={`p-4 rounded-lg border transition-all text-left group ${
							isSelected
								? `border-dash-accent bg-dash-accent-subtle ring-2 ${colors.ring}`
								: "border-dash-border bg-dash-surface hover:bg-dash-surface-hover"
						}`}
					>
						<div className="flex items-center gap-2 mb-3">
							<span
								className={`${colors.text} opacity-70 group-hover:opacity-100 transition-opacity`}
							>
								{GROUP_ICONS[group]}
							</span>
							<span className="text-[11px] font-semibold text-dash-text uppercase tracking-wide truncate">
								{t(`healthGroup_${group}` as Parameters<typeof t>[0])}
							</span>
						</div>
						{/* Progress bar */}
						<div className="h-1.5 w-full bg-dash-border-subtle rounded-full overflow-hidden mb-2">
							<div
								className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
								style={{ width: `${pct}%` }}
							/>
						</div>
						<div className="flex items-baseline justify-between">
							<span className={`text-lg font-bold ${colors.text}`}>
								{stats.passed}/{stats.total}
							</span>
							{(stats.failed > 0 || stats.warnings > 0) && (
								<div className="flex gap-1.5 text-[10px]">
									{stats.failed > 0 && <span className="text-red-500">{stats.failed}F</span>}
									{stats.warnings > 0 && <span className="text-amber-500">{stats.warnings}W</span>}
								</div>
							)}
						</div>
					</button>
				);
			})}
		</div>
	);
};

export default HealthStatusCards;
