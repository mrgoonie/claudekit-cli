/**
 * Compact vertical bar chart showing session distribution across 24 hours
 * Replaces the tall horizontal layout with a more space-efficient design
 */
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";

interface HourEntry {
	hour: number;
	count: number;
}

interface InsightsPeakHoursProps {
	data: HourEntry[];
}

const CHART_HEIGHT = 100;
const BAR_WIDTH = 14;
const BAR_GAP = 3;
const Y_LABEL_WIDTH = 24;
const X_LABEL_HEIGHT = 18;

export function InsightsPeakHours({ data }: InsightsPeakHoursProps) {
	const { t } = useI18n();
	const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
	const [hoveredHour, setHoveredHour] = useState<number | null>(null);

	const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

	// Ensure all 24 hours present, sorted
	const hours = useMemo(() => {
		const lookup = new Map(data.map((d) => [d.hour, d.count]));
		return Array.from({ length: 24 }, (_, h) => ({
			hour: h,
			count: lookup.get(h) ?? 0,
		}));
	}, [data]);

	const chartAreaWidth = 24 * (BAR_WIDTH + BAR_GAP);
	const svgWidth = Y_LABEL_WIDTH + chartAreaWidth + 4;
	const svgHeight = CHART_HEIGHT + X_LABEL_HEIGHT;

	const yTicks = [0, Math.round(maxCount / 2), maxCount];

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4 h-full flex flex-col">
			<h3 className="text-sm font-medium text-dash-text-secondary mb-3 shrink-0">
				{t("insightsPeakHours")}
			</h3>
			<div className="flex-1 min-h-0 overflow-hidden">
				<svg
					width="100%"
					height="100%"
					viewBox={`0 0 ${svgWidth} ${svgHeight}`}
					preserveAspectRatio="xMidYMid meet"
					className="block"
				>
					{/* Y-axis gridlines */}
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
					{hours.map((entry) => {
						const barH = maxCount > 0 ? (entry.count / maxCount) * CHART_HEIGHT : 0;
						const x = Y_LABEL_WIDTH + entry.hour * (BAR_WIDTH + BAR_GAP);
						const y = CHART_HEIGHT - barH;
						const isHovered = hoveredHour === entry.hour;

						return (
							<g
								key={entry.hour}
								className="cursor-pointer"
								onMouseEnter={(e) => {
									setHoveredHour(entry.hour);
									const rect = (
										e.currentTarget.querySelector("rect") as SVGRectElement
									)?.getBoundingClientRect();
									if (rect) {
										setTooltip({
											x: rect.left + rect.width / 2,
											y: rect.top,
											text: `${entry.hour.toString().padStart(2, "0")}:00 — ${entry.count}`,
										});
									}
								}}
								onMouseLeave={() => {
									setHoveredHour(null);
									setTooltip(null);
								}}
							>
								<rect
									x={x}
									y={y}
									width={BAR_WIDTH}
									height={Math.max(barH, 1)}
									rx={2}
									fill="var(--dash-accent)"
									opacity={isHovered ? 1 : 0.6}
								/>
								{/* X-axis labels: every 3 hours for readability */}
								{entry.hour % 3 === 0 && (
									<text
										x={x + BAR_WIDTH / 2}
										y={CHART_HEIGHT + 12}
										fontSize="8"
										fill="var(--dash-text-muted)"
										textAnchor="middle"
									>
										{entry.hour.toString().padStart(2, "0")}
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
		</div>
	);
}
