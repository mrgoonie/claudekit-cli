/**
 * SVG bar chart showing sessions per day (last 30 days)
 */
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";

interface DailySession {
	date: string;
	count: number;
}

interface InsightsSessionsChartProps {
	data: DailySession[];
}

const CHART_HEIGHT = 120;
const BAR_GAP = 2;

export function InsightsSessionsChart({ data }: InsightsSessionsChartProps) {
	const { t } = useI18n();
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

	const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

	const barWidth = data.length > 0 ? Math.max(4, (600 - data.length * BAR_GAP) / data.length) : 8;
	const svgWidth = data.length * (barWidth + BAR_GAP);

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4">
			<h3 className="text-sm font-medium text-dash-text-secondary mb-3">
				{t("insightsSessionsPerDay")}
			</h3>
			<div className="overflow-x-auto">
				<svg
					width={svgWidth}
					height={CHART_HEIGHT + 20}
					viewBox={`0 0 ${svgWidth} ${CHART_HEIGHT + 20}`}
					className="block"
				>
					{data.map((entry, i) => {
						const barHeight = maxCount > 0 ? (entry.count / maxCount) * CHART_HEIGHT : 0;
						const x = i * (barWidth + BAR_GAP);
						const y = CHART_HEIGHT - barHeight;
						const isHovered = hoveredIdx === i;

						return (
							<g key={entry.date}>
								<rect
									x={x}
									y={y}
									width={barWidth}
									height={Math.max(barHeight, 1)}
									rx={2}
									fill="var(--dash-accent)"
									opacity={isHovered ? 1 : 0.7}
									className="cursor-pointer transition-opacity"
									onMouseEnter={() => setHoveredIdx(i)}
									onMouseLeave={() => setHoveredIdx(null)}
								/>
								{/* X-axis label: show every 7th day */}
								{i % 7 === 0 && (
									<text
										x={x + barWidth / 2}
										y={CHART_HEIGHT + 14}
										fontSize="8"
										fill="var(--dash-text-muted)"
										textAnchor="middle"
									>
										{entry.date.slice(5)}
									</text>
								)}
								{/* Hover tooltip */}
								{isHovered && (
									<>
										<rect
											x={x - 20}
											y={y - 22}
											width={barWidth + 40}
											height={16}
											rx={3}
											fill="var(--dash-surface-hover)"
											stroke="var(--dash-border)"
											strokeWidth="0.5"
										/>
										<text
											x={x + barWidth / 2}
											y={y - 10}
											fontSize="9"
											fill="var(--dash-text)"
											textAnchor="middle"
										>
											{entry.date.slice(5)}: {entry.count}
										</text>
									</>
								)}
							</g>
						);
					})}
				</svg>
			</div>
		</div>
	);
}
