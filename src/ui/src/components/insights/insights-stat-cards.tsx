/**
 * Stat cards for the Insights page — Total Sessions, Projects, Avg Duration
 * Each card has an SVG icon, accent color, and the primary metric
 */
import { useI18n } from "../../i18n";

interface InsightsStatCardsProps {
	totalSessions: number;
	totalProjects: number;
	avgDuration: number;
	/** Vertical stack layout for side-by-side with heatmap */
	compact?: boolean;
}

function SessionsIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M7 16l4-8 4 4 5-9" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function ProjectsIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path
				d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function DurationIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function InsightsStatCards({
	totalSessions,
	totalProjects,
	avgDuration,
	compact,
}: InsightsStatCardsProps) {
	const { t } = useI18n();

	const cards = [
		{
			label: t("totalSessions"),
			value: totalSessions.toLocaleString(),
			sub: t("insightsAllTime"),
			icon: <SessionsIcon />,
		},
		{
			label: t("totalProjects"),
			value: totalProjects.toLocaleString(),
			sub: t("insightsTracked"),
			icon: <ProjectsIcon />,
		},
		{
			label: t("insightsAvgDuration"),
			value: `${avgDuration}m`,
			sub: t("insightsPerSession"),
			icon: <DurationIcon />,
		},
	];

	return (
		<div
			className={compact ? "flex flex-col gap-2 h-full" : "grid grid-cols-1 sm:grid-cols-3 gap-4"}
		>
			{cards.map((card) => (
				<div
					key={card.label}
					className={`bg-dash-surface border border-dash-border rounded-lg flex items-start gap-3 ${compact ? "p-3 flex-1" : "p-4"}`}
				>
					<div className="shrink-0 w-9 h-9 rounded-md bg-dash-accent-subtle flex items-center justify-center text-dash-accent">
						{card.icon}
					</div>
					<div className="min-w-0">
						<p className="text-xs text-dash-text-muted">{card.label}</p>
						<p
							className={`font-bold text-dash-text leading-tight mt-0.5 ${compact ? "text-lg" : "text-2xl"}`}
						>
							{card.value}
						</p>
						<p className="text-[11px] text-dash-text-muted mt-0.5">{card.sub}</p>
					</div>
				</div>
			))}
		</div>
	);
}
