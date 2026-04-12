import { useI18n } from "../../i18n";
import type { TimelineData } from "../../types/plan-types";

function formatDate(value: string): string {
	return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const BAR_CLASS: Record<string, string> = {
	pending: "bg-amber-500/70",
	"in-progress": "bg-sky-500/70",
	completed: "bg-emerald-500/70",
};

export default function PlanTimeline({
	timeline,
	onOpenPhase,
}: { timeline: TimelineData; onOpenPhase: (file: string) => void }) {
	const { t } = useI18n();
	const axis = Array.from({ length: 7 }, (_, index) => {
		const total = new Date(timeline.rangeEnd).getTime() - new Date(timeline.rangeStart).getTime();
		const stamp = new Date(new Date(timeline.rangeStart).getTime() + (total / 6) * index);
		return formatDate(stamp.toISOString());
	});

	return (
		<section className="rounded-xl border border-dash-border bg-dash-surface p-5">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-lg font-semibold text-dash-text">{t("plansTimeline")}</h2>
				<p className="text-sm text-dash-text-muted">
					{timeline.summary.avgDurationDays.toFixed(1)} avg days
				</p>
			</div>
			<div className="grid grid-cols-7 gap-2 text-xs text-dash-text-muted">
				{axis.map((label) => (
					<span key={label}>{label}</span>
				))}
			</div>
			<div
				className="relative mt-4 overflow-x-auto rounded-lg border border-dash-border bg-dash-bg p-4"
				style={{ minHeight: `${Math.max(120, timeline.layerCount * 36 + 48)}px` }}
			>
				<div
					className="absolute bottom-0 top-0 w-px bg-dash-accent/60"
					style={{ left: `${timeline.todayPct}%` }}
				/>
				{timeline.phases.map((phase) => (
					<button
						key={phase.phaseId}
						type="button"
						onClick={() => onOpenPhase(phase.file)}
						title={`${phase.name} • ${phase.effort ?? "No effort"}`}
						className={`absolute flex h-6 items-center rounded-md px-2 text-xs text-white ${BAR_CLASS[phase.status]}`}
						style={{
							top: `${phase.layer * 34 + 16}px`,
							left: `${phase.leftPct}%`,
							width: `${phase.widthPct}%`,
						}}
					>
						<span className="truncate">
							{phase.phaseId} · {phase.name}
						</span>
					</button>
				))}
			</div>
		</section>
	);
}
