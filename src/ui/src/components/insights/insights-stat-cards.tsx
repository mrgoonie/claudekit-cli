/**
 * Stat cards for the Insights page — Total Sessions, Projects, Avg Duration
 */
import { useI18n } from "../../i18n";

interface InsightsStatCardsProps {
	totalSessions: number;
	totalProjects: number;
	avgDuration: number;
}

export function InsightsStatCards({
	totalSessions,
	totalProjects,
	avgDuration,
}: InsightsStatCardsProps) {
	const { t } = useI18n();

	const cards = [
		{
			label: t("totalSessions"),
			value: totalSessions.toLocaleString(),
			sub: t("insightsAllTime"),
		},
		{
			label: t("totalProjects"),
			value: totalProjects.toLocaleString(),
			sub: t("insightsTracked"),
		},
		{
			label: t("insightsAvgDuration"),
			value: `${avgDuration}m`,
			sub: t("insightsPerSession"),
		},
	];

	return (
		<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
			{cards.map((card) => (
				<div key={card.label} className="bg-dash-surface border border-dash-border rounded-lg p-4">
					<p className="text-sm text-dash-text-secondary">{card.label}</p>
					<p className="text-2xl font-bold text-dash-text mt-1">{card.value}</p>
					<p className="text-xs text-dash-text-muted mt-1">{card.sub}</p>
				</div>
			))}
		</div>
	);
}
