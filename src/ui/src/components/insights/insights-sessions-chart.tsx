/**
 * SVG bar chart showing sessions per day (last 30 days)
 * Responsive via viewBox, y-axis labels, HTML tooltip outside SVG
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
const Y_LABEL_WIDTH = 28;
const X_LABEL_HEIGHT = 18;

export function InsightsSessionsChart({ data }: InsightsSessionsChartProps) {
	const { t } = useI18n();
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
	const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

	const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

	const barWidth = data.length > 0 ? Math.max(4, (500 - data.length * BAR_GAP) / data.length) : 8;
	const chartAreaWidth = data.length * (barWidth + BAR_GAP);
	const svgWidth = Y_LABEL_WIDTH + chartAreaWidth + 4;
	const svgHeight = CHART_HEIGHT + X_LABEL_HEIGHT;

	// Y-axis tick values: 0, mid, max
	const yTicks = [0, Math.round(maxCount / 2), maxCount];

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4 h-full flex flex-col">
			<h3 className="text-sm font-medium text-dash-text-secondary mb-3 shrink-0">
				{t("insightsSessionsPerDay")}
			</h3>
			{data.length === 0 ? (
				<p className="text-sm text-dash-text-muted">{t("insightsNoData")}</p>
			) : (
				<div className="flex-1 min-h-0 overflow-hidden">
					<svg
						width="100%"
						height="100%"
						viewBox={`0 0 ${svgWidth} ${svgHeight}`}
						preserveAspectRatio="xMidYMid meet"
						className="block"
					>
						{/* Y-axis labels */}
						{yTicks.map((tick) => {
							const y = CHART_HEIGHT - (tick / maxCount) * CHART_HEIGHT;
							return (
								<g key={tick}>
									<text
										x={Y_LABEL_WIDTH - 4}
										y={y}
										fontSize="8"
										fill="var(--dash-text-muted)"
										textAnchor="end"
										dominantBaseline="middle"
									>
										{tick}
									</text>
									<line
										x1={Y_LABEL_WIDTH}
										y1={y}
										x2={Y_LABEL_WIDTH + chartAreaWidth}
										y2={y}
										stroke="var(--dash-border-subtle)"
										strokeWidth="0.5"
										strokeDasharray="3,3"
									/>
								</g>
							);
						})}

						{/* Bars */}
						{data.map((entry, i) => {
							const barHeight = maxCount > 0 ? (entry.count / maxCount) * CHART_HEIGHT : 0;
							const x = Y_LABEL_WIDTH + i * (barWidth + BAR_GAP);
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
										onMouseEnter={(e) => {
											setHoveredIdx(i);
											const rect = e.currentTarget.getBoundingClientRect();
											setTooltip({
												x: rect.left + rect.width / 2,
												y: rect.top,
												text: `${entry.date.slice(5)}: ${entry.count}`,
											});
										}}
										onMouseLeave={() => {
											setHoveredIdx(null);
											setTooltip(null);
										}}
									/>
									{/* X-axis label: show every 7th day */}
									{i % 7 === 0 && (
										<text
											x={x + barWidth / 2}
											y={CHART_HEIGHT + 12}
											fontSize="8"
											fill="var(--dash-text-muted)"
											textAnchor="middle"
										>
											{entry.date.slice(5)}
										</text>
									)}
								</g>
							);
						})}
					</svg>

					{/* HTML tooltip */}
					{tooltip && (
						<div
							className="fixed z-50 px-2 py-1 text-xs rounded bg-dash-surface-hover border border-dash-border text-dash-text shadow-lg pointer-events-none"
							style={{
								left: tooltip.x,
								top: tooltip.y - 28,
								transform: "translateX(-50%)",
							}}
						>
							{tooltip.text}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
