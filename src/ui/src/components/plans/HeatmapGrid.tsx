import { useI18n } from "../../i18n";
import type { HeatmapCell } from "../../types/plan-types";

const LEVEL_CLASS: Record<HeatmapCell["level"], string> = {
	0: "bg-dash-bg",
	1: "bg-emerald-500/20",
	2: "bg-emerald-500/50",
	3: "bg-emerald-400",
};

export default function HeatmapGrid({ cells }: { cells: HeatmapCell[] }) {
	const { t } = useI18n();
	const days = [
		{ label: t("plansHeatmapMon"), index: 1 },
		{ label: t("plansHeatmapWed"), index: 3 },
		{ label: t("plansHeatmapFri"), index: 5 },
	];

	return (
		<div className="flex w-fit items-start gap-3">
			<div className="grid grid-rows-7 gap-1 pt-[1px] text-[10px] uppercase tracking-tighter text-dash-text-muted">
				{Array.from({ length: 7 }, (_, i) => {
					const day = days.find((d) => d.index === i);
					return (
						<div key={i} className="flex h-3.5 items-center justify-end pr-1">
							{day?.label ?? ""}
						</div>
					);
				})}
			</div>
			<div className="grid grid-cols-12 gap-1">
				{Array.from({ length: 12 }, (_, weekIndex) => (
					<div key={weekIndex} className="grid grid-rows-7 gap-1">
						{cells
							.filter((cell) => cell.weekIndex === weekIndex)
							.map((cell) => (
								<div
									key={cell.date}
									title={t("plansHeatmapChanges")
										.replace("{date}", new Date(cell.date).toLocaleDateString())
										.replace("{count}", String(cell.totalActivity))}
									className={`h-3.5 w-3.5 rounded-sm transition-colors duration-300 ${LEVEL_CLASS[cell.level]}`}
								/>
							))}
					</div>
				))}
			</div>
		</div>
	);
}
