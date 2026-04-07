/**
 * SystemActivityMetrics — cross-project session activity panel.
 *
 * Shows:
 * - Total sessions KPI card
 * - Period toggle: 24h / 7d / 30d
 * - Most active projects ranked list (top 5, CSS-only bar chart)
 * - Daily session bar chart (CSS-only)
 *
 * Data source: GET /api/sessions/activity?period={period}
 */
import React from "react";
import { type ActivityPeriod, useActivityMetrics } from "../hooks/use-activity-metrics";
import { useI18n } from "../i18n";

const TOP_PROJECTS = 5;

// ---- Period toggle -------------------------------------------------------

interface PeriodToggleProps {
	value: ActivityPeriod;
	onChange: (p: ActivityPeriod) => void;
}

const PERIODS: ActivityPeriod[] = ["24h", "7d", "30d"];

const PeriodToggle: React.FC<PeriodToggleProps> = ({ value, onChange }) => {
	const { t } = useI18n();
	const labelMap: Record<ActivityPeriod, string> = {
		"24h": t("activityPeriod24h"),
		"7d": t("activityPeriod7d"),
		"30d": t("activityPeriod30d"),
	};
	return (
		<div className="inline-flex rounded-lg border border-dash-border overflow-hidden">
			{PERIODS.map((p) => (
				<button
					key={p}
					type="button"
					aria-pressed={value === p}
					onClick={() => onChange(p)}
					className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
						value === p
							? "bg-dash-accent-subtle text-dash-accent border-r border-dash-accent/30 last:border-r-0"
							: "bg-dash-surface text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover border-r border-dash-border last:border-r-0"
					}`}
				>
					{labelMap[p]}
				</button>
			))}
		</div>
	);
};

// ---- Mini bar chart (CSS-only) -------------------------------------------

interface BarChartProps {
	data: Array<{ date: string; count: number }>;
}

const MiniBarChart: React.FC<BarChartProps> = ({ data }) => {
	const max = Math.max(...data.map((d) => d.count), 1);
	// Show at most 30 bars; thin bars for many days
	const bars = data.slice(-30);

	return (
		<div
			className="flex items-end gap-px h-12 w-full"
			role="img"
			aria-label="Daily session activity chart"
		>
			{bars.map((d) => {
				const heightPct = Math.max((d.count / max) * 100, d.count > 0 ? 8 : 2);
				return (
					<div
						key={d.date}
						className="flex-1 min-w-0 rounded-t-sm transition-all"
						style={{
							height: `${heightPct}%`,
							backgroundColor:
								d.count > 0 ? "rgb(var(--dash-accent) / 0.5)" : "rgb(var(--dash-border) / 0.4)",
						}}
						title={`${d.date}: ${d.count}`}
					/>
				);
			})}
		</div>
	);
};

// ---- Ranked project list -------------------------------------------------

interface ProjectRankListProps {
	projects: Array<{ name: string; path: string; sessionCount: number }>;
	maxCount: number;
}

const ProjectRankList: React.FC<ProjectRankListProps> = ({ projects, maxCount }) => {
	return (
		<div className="space-y-2">
			{projects.map((proj, i) => {
				const barWidth = maxCount > 0 ? (proj.sessionCount / maxCount) * 100 : 0;
				// Derive a short display name from the Claude path-encoded directory name
				// (dashes replaced by slashes gives back the original path)
				const displayName = proj.name.startsWith("-")
					? (proj.name.replace(/^-/, "").replace(/-/g, "/").split("/").pop() ?? proj.name)
					: proj.name;

				return (
					<div key={proj.path} className="space-y-1">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-1.5 min-w-0">
								<span className="mono text-[10px] text-dash-text-muted w-3 flex-shrink-0">
									{i + 1}
								</span>
								<span className="text-xs text-dash-text truncate" title={proj.path}>
									{displayName}
								</span>
							</div>
							<span className="mono text-xs text-dash-text-secondary flex-shrink-0">
								{proj.sessionCount}
							</span>
						</div>
						{/* CSS bar */}
						<div className="h-1 rounded-full bg-dash-border/40 overflow-hidden">
							<div
								className="h-full rounded-full transition-all"
								style={{
									width: `${barWidth}%`,
									backgroundColor: "rgb(var(--dash-accent) / 0.45)",
								}}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
};

// ---- Main component ------------------------------------------------------

interface SystemActivityMetricsProps {
	defaultPeriod?: ActivityPeriod;
}

const SystemActivityMetrics: React.FC<SystemActivityMetricsProps> = ({ defaultPeriod = "7d" }) => {
	const { t } = useI18n();
	const [period, setPeriod] = React.useState<ActivityPeriod>(defaultPeriod);
	const { data, loading, error } = useActivityMetrics(period);

	const topProjects = data?.projects.slice(0, TOP_PROJECTS) ?? [];
	const maxCount = topProjects[0]?.sessionCount ?? 1;

	return (
		<section className="dash-panel p-4 space-y-4">
			{/* Header row */}
			<div className="flex items-center justify-between gap-2 flex-wrap">
				<h3 className="text-sm font-semibold uppercase tracking-wide text-dash-text">
					{t("activityMetrics")}
				</h3>
				<PeriodToggle value={period} onChange={setPeriod} />
			</div>

			{/* Total sessions KPI */}
			<div className="rounded-lg border border-dash-border bg-dash-bg/60 px-3 py-2">
				<p className="text-[11px] uppercase tracking-wide text-dash-text-muted">
					{t("activityTotalSessions")}
				</p>
				<p className="mono mt-1 text-xl font-semibold text-dash-text">
					{loading ? "…" : (data?.totalSessions ?? 0).toString()}
				</p>
			</div>

			{/* Loading / error states */}
			{loading && <p className="text-sm text-dash-text-muted">{t("hookDiagnosticsLoading")}</p>}
			{!loading && error && <p className="text-sm text-red-400">{error}</p>}

			{!loading && !error && (!data || data.totalSessions === 0) && (
				<p className="text-sm text-dash-text-muted">{t("activityNoData")}</p>
			)}

			{/* Daily bar chart */}
			{!loading && !error && data && data.dailyCounts.length > 0 && (
				<MiniBarChart data={data.dailyCounts} />
			)}

			{/* Most active projects */}
			{!loading && !error && topProjects.length > 0 && (
				<div className="space-y-2">
					<p className="text-[11px] uppercase tracking-wide text-dash-text-muted">
						{t("activityMostActive")}
					</p>
					<ProjectRankList projects={topProjects} maxCount={maxCount} />
				</div>
			)}
		</section>
	);
};

export default SystemActivityMetrics;
