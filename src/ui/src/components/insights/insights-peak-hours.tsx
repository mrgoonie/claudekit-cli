/**
 * Horizontal SVG bar chart showing session distribution across 24 hours
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

const BAR_HEIGHT = 14;
const BAR_GAP = 2;
const LABEL_WIDTH = 32;
const CHART_WIDTH = 300;

export function InsightsPeakHours({ data }: InsightsPeakHoursProps) {
	const { t } = useI18n();
	const [hoveredHour, setHoveredHour] = useState<number | null>(null);

	const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

	const svgHeight = data.length * (BAR_HEIGHT + BAR_GAP);
	const svgWidth = LABEL_WIDTH + CHART_WIDTH + 40;

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4">
			<h3 className="text-sm font-medium text-dash-text-secondary mb-3">
				{t("insightsPeakHours")}
			</h3>
			<div className="overflow-y-auto max-h-[420px]">
				<svg
					width={svgWidth}
					height={svgHeight}
					viewBox={`0 0 ${svgWidth} ${svgHeight}`}
					className="block"
				>
					{data.map((entry, i) => {
						const y = i * (BAR_HEIGHT + BAR_GAP);
						const barW = maxCount > 0 ? (entry.count / maxCount) * CHART_WIDTH : 0;
						const isHovered = hoveredHour === entry.hour;
						const label = `${entry.hour.toString().padStart(2, "0")}:00`;

						return (
							<g
								key={entry.hour}
								onMouseEnter={() => setHoveredHour(entry.hour)}
								onMouseLeave={() => setHoveredHour(null)}
								className="cursor-pointer"
							>
								<text
									x={LABEL_WIDTH - 4}
									y={y + BAR_HEIGHT / 2}
									fontSize="9"
									fill="var(--dash-text-muted)"
									textAnchor="end"
									dominantBaseline="middle"
								>
									{label}
								</text>
								<rect
									x={LABEL_WIDTH}
									y={y}
									width={Math.max(barW, 1)}
									height={BAR_HEIGHT}
									rx={3}
									fill="var(--dash-accent)"
									opacity={isHovered ? 1 : 0.6}
								/>
								{entry.count > 0 && (
									<text
										x={LABEL_WIDTH + barW + 4}
										y={y + BAR_HEIGHT / 2}
										fontSize="9"
										fill="var(--dash-text-muted)"
										dominantBaseline="middle"
									>
										{entry.count}
									</text>
								)}
							</g>
						);
					})}
				</svg>
			</div>
		</div>
	);
}
