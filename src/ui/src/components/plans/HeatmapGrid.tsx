import type { HeatmapCell } from "../../types/plan-types";

const LEVEL_CLASS: Record<HeatmapCell["level"], string> = {
	0: "bg-dash-bg",
	1: "bg-emerald-900/50",
	2: "bg-emerald-600/70",
	3: "bg-emerald-400",
};

export default function HeatmapGrid({ cells }: { cells: HeatmapCell[] }) {
	return (
		<div className="grid grid-cols-12 gap-2">
			{Array.from({ length: 12 }, (_, weekIndex) => (
				<div key={weekIndex} className="grid grid-rows-7 gap-2">
					{cells
						.filter((cell) => cell.weekIndex === weekIndex)
						.map((cell) => (
							<div
								key={cell.date}
								title={`${new Date(cell.date).toLocaleDateString()} • ${cell.totalActivity} changes`}
								className={`aspect-square rounded ${LEVEL_CLASS[cell.level]}`}
							/>
						))}
				</div>
			))}
		</div>
	);
}
