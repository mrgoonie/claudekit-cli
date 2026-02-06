/**
 * Insights page — usage analytics with SVG charts
 */
import { useEffect, useState } from "react";
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

const InsightsPage: React.FC = () => {
	const { t } = useI18n();
	const [data, setData] = useState<InsightsData | null>(null);
	const [heatmap, setHeatmap] = useState<Array<{ date: string; count: number }>>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const [insights, heatmapData] = await Promise.all([
					fetchUserInsights(),
					fetchActivityHeatmap(),
				]);

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
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Unknown error");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<p className="text-dash-text-muted">{t("loading")}</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="flex items-center justify-center h-64">
				<p className="text-red-400">{error || t("error")}</p>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6 max-w-5xl">
			<h1 className="text-xl font-bold text-dash-text">{t("insightsTitle")}</h1>

			<InsightsStatCards
				totalSessions={data.totalSessions}
				totalProjects={data.totalProjects}
				avgDuration={data.avgDuration}
			/>

			<InsightsActivityHeatmap data={heatmap} />

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<InsightsSessionsChart data={data.dailySessions} />
				<InsightsTopProjects projects={data.topProjects} />
			</div>

			<InsightsPeakHours data={data.peakHours} />
		</div>
	);
};

export default InsightsPage;
