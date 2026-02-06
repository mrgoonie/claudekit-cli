/**
 * GitHub-style activity heatmap using pure SVG (90 days)
 */
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n";

interface HeatmapEntry {
	date: string;
	count: number;
}

interface InsightsActivityHeatmapProps {
	data: HeatmapEntry[];
}

const CELL_SIZE = 12;
const CELL_GAP = 2;
const CELL_TOTAL = CELL_SIZE + CELL_GAP;
const DAYS_OF_WEEK = 7;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function getColorOpacity(count: number, maxCount: number): string {
	if (count === 0) return "0.08";
	if (maxCount === 0) return "0.08";
	const ratio = count / maxCount;
	if (ratio <= 0.25) return "0.3";
	if (ratio <= 0.5) return "0.5";
	if (ratio <= 0.75) return "0.7";
	return "1";
}

export function InsightsActivityHeatmap({ data }: InsightsActivityHeatmapProps) {
	const { t } = useI18n();
	const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

	const { grid, weeks, maxCount } = useMemo(() => {
		const lookup = new Map(data.map((d) => [d.date, d.count]));
		const today = new Date();
		const cells: Array<{ date: string; count: number; col: number; row: number }> = [];

		// Work back 90 days, build grid columns (weeks)
		let maxC = 0;
		const startDate = new Date(today);
		startDate.setDate(startDate.getDate() - 89);

		// Align to start of week (Sunday)
		const startDay = startDate.getDay();
		const alignedStart = new Date(startDate);
		alignedStart.setDate(alignedStart.getDate() - startDay);

		const totalDays =
			Math.ceil((today.getTime() - alignedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const numWeeks = Math.ceil(totalDays / 7);

		for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
			const d = new Date(alignedStart);
			d.setDate(d.getDate() + dayOffset);
			const key = d.toISOString().slice(0, 10);
			const count = lookup.get(key) ?? 0;
			if (count > maxC) maxC = count;

			const col = Math.floor(dayOffset / 7);
			const row = dayOffset % 7;

			// Only include cells within the 90-day range
			if (d >= startDate && d <= today) {
				cells.push({ date: key, count, col, row });
			}
		}

		return { grid: cells, weeks: numWeeks, maxCount: maxC };
	}, [data]);

	const labelWidth = 28;
	const svgWidth = labelWidth + weeks * CELL_TOTAL + 4;
	const svgHeight = DAYS_OF_WEEK * CELL_TOTAL + 4;

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4">
			<h3 className="text-sm font-medium text-dash-text-secondary mb-3">
				{t("insightsActivityHeatmap")}
			</h3>
			<div className="overflow-x-auto">
				<svg
					width={svgWidth}
					height={svgHeight}
					viewBox={`0 0 ${svgWidth} ${svgHeight}`}
					className="block"
				>
					{/* Day labels */}
					{DAY_LABELS.map(
						(label, i) =>
							label && (
								<text
									key={i}
									x={0}
									y={i * CELL_TOTAL + CELL_SIZE}
									fontSize="9"
									fill="var(--dash-text-muted)"
									dominantBaseline="middle"
								>
									{label}
								</text>
							),
					)}

					{/* Heatmap cells */}
					{grid.map((cell) => (
						<rect
							key={cell.date}
							x={labelWidth + cell.col * CELL_TOTAL}
							y={cell.row * CELL_TOTAL}
							width={CELL_SIZE}
							height={CELL_SIZE}
							rx={2}
							fill="var(--dash-accent)"
							opacity={getColorOpacity(cell.count, maxCount)}
							className="cursor-pointer"
							onMouseEnter={(e) => {
								const rect = e.currentTarget.getBoundingClientRect();
								setTooltip({
									x: rect.left + rect.width / 2,
									y: rect.top,
									text: `${cell.date}: ${cell.count} ${cell.count === 1 ? "session" : "sessions"}`,
								});
							}}
							onMouseLeave={() => setTooltip(null)}
						/>
					))}
				</svg>
			</div>

			{/* Tooltip rendered outside SVG for proper layering */}
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

			{/* Legend */}
			<div className="flex items-center gap-1 mt-2 text-xs text-dash-text-muted">
				<span>{t("insightsLess")}</span>
				{[0.08, 0.3, 0.5, 0.7, 1].map((opacity) => (
					<svg key={opacity} width={CELL_SIZE} height={CELL_SIZE}>
						<rect
							width={CELL_SIZE}
							height={CELL_SIZE}
							rx={2}
							fill="var(--dash-accent)"
							opacity={opacity}
						/>
					</svg>
				))}
				<span>{t("insightsMore")}</span>
			</div>
		</div>
	);
}
