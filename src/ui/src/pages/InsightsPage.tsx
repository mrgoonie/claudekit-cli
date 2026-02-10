/**
 * Insights page — usage analytics with SVG charts
 * Sticky header matching HealthPage pattern, skeleton loading, responsive grid
 */
import { useCallback, useEffect, useState } from "react";
import { InsightsActivityHeatmap } from "../components/insights/insights-activity-heatmap";
import { InsightsPeakHours } from "../components/insights/insights-peak-hours";
import { InsightsSessionsChart } from "../components/insights/insights-sessions-chart";
import { InsightsStatCards } from "../components/insights/insights-stat-cards";
import { InsightsTopProjects } from "../components/insights/insights-top-projects";
import { useI18n } from "../i18n";
import { fetchActivityHeatmap, fetchUserInsights } from "../services/api";

interface InsightsData {
	totalSessions: number;
	totalProjects: number;
	avgDuration: number;
	dailySessions: Array<{ date: string; count: number }>;
	peakHours: Array<{ hour: number; count: number }>;
	topProjects: Array<{ name: string; path: string; interactionCount: number }>;
}

function InsightsSkeleton() {
	return (
		<div className="animate-pulse space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="bg-dash-surface border border-dash-border rounded-lg p-4 h-24" />
				))}
			</div>
			<div className="bg-dash-surface border border-dash-border rounded-lg p-4 h-36" />
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="bg-dash-surface border border-dash-border rounded-lg p-4 h-52" />
				<div className="bg-dash-surface border border-dash-border rounded-lg p-4 h-52" />
			</div>
			<div className="bg-dash-surface border border-dash-border rounded-lg p-4 h-44" />
		</div>
	);
}

const InsightsPage: React.FC = () => {
	const { t } = useI18n();
	const [data, setData] = useState<InsightsData | null>(null);
	const [heatmap, setHeatmap] = useState<Array<{ date: string; count: number }>>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(() => {
		setLoading(true);
		setError(null);
		let cancelled = false;

		Promise.all([fetchUserInsights(), fetchActivityHeatmap()])
			.then(([insights, heatmapData]) => {
				if (cancelled) return;
				setData({
					totalSessions: insights.usageStats.totalInteractions,
					totalProjects: insights.usageStats.totalProjects,
					avgDuration: insights.averageSessionDuration,
					dailySessions: insights.dailySessions,
					peakHours: insights.peakHours,
					topProjects: insights.mostUsedProjects.map((p) => ({
						name: p.name,
						path: p.path,
						interactionCount: p.interactionCount,
					})),
				});
				setHeatmap(heatmapData);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const cancel = reload();
		return cancel;
	}, [reload]);

	const hasData = data && (data.totalSessions > 0 || data.topProjects.length > 0);

	return (
		<div className="h-full flex flex-col">
			{/* Sticky header */}
			<div className="border-b border-dash-border bg-dash-surface px-6 sm:px-8 py-5">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-dash-text">{t("insightsTitle")}</h1>
						<p className="text-sm text-dash-text-muted mt-0.5">{t("insightsSubtitle")}</p>
					</div>
					{!loading && !error && (
						<button
							type="button"
							onClick={reload}
							className="px-3 py-1.5 border border-dash-border text-dash-text-secondary rounded-md text-xs font-medium hover:bg-dash-surface-hover transition-colors"
						>
							{t("insightsRefresh")}
						</button>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-hidden px-6 sm:px-8 py-4 min-h-0">
				{loading && <InsightsSkeleton />}

				{error && (
					<div className="flex items-center justify-center h-64">
						<div className="text-center max-w-md">
							<div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									className="text-red-500"
								>
									<circle cx="12" cy="12" r="10" />
									<path d="M12 8v4M12 16h.01" strokeLinecap="round" />
								</svg>
							</div>
							<p className="text-sm font-semibold text-dash-text mb-1">{t("error")}</p>
							<p className="text-xs text-dash-text-muted mb-3">{error}</p>
							<button
								type="button"
								onClick={reload}
								className="px-4 py-2 bg-dash-accent text-white rounded-md text-xs font-medium hover:bg-dash-accent/90 transition-colors"
							>
								{t("tryAgain")}
							</button>
						</div>
					</div>
				)}

				{!loading && !error && data && !hasData && (
					<div className="flex items-center justify-center h-64">
						<div className="text-center max-w-md">
							<div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.5"
									className="text-blue-500"
								>
									<path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
									<path d="M7 16l4-8 4 4 5-9" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</div>
							<p className="text-sm font-semibold text-dash-text mb-1">{t("insightsNoData")}</p>
							<p className="text-xs text-dash-text-muted">{t("insightsEmptyState")}</p>
						</div>
					</div>
				)}

				{!loading && !error && data && hasData && (
					<div className="flex flex-col gap-4 h-full min-h-0">
						{/* Row 1: Stat cards + Heatmap side by side */}
						<div className="flex flex-col lg:flex-row gap-4 shrink-0">
							<div className="lg:w-64 xl:w-72 shrink-0">
								<InsightsStatCards
									totalSessions={data.totalSessions}
									totalProjects={data.totalProjects}
									avgDuration={data.avgDuration}
									compact
								/>
							</div>
							<div className="flex-1 min-w-0">
								<InsightsActivityHeatmap data={heatmap} />
							</div>
						</div>

						{/* Row 2: Sessions + Peak Hours + Top Projects — fills remaining space */}
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
							<InsightsSessionsChart data={data.dailySessions} />
							<InsightsPeakHours data={data.peakHours} />
							<InsightsTopProjects projects={data.topProjects} />
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default InsightsPage;
