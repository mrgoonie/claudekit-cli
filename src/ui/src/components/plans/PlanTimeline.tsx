import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { PhaseStatus, TimelineData } from "../../types/plan-types";

function formatDate(value: string): string {
	return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const BAR_CLASS: Record<PhaseStatus, string> = {
	pending: "from-amber-500/40 to-amber-500/20 border-amber-500/30 text-amber-100",
	"in-progress": "from-sky-500/40 to-sky-500/20 border-sky-500/30 text-sky-100",
	completed: "from-emerald-500/40 to-emerald-500/20 border-emerald-500/30 text-emerald-100",
};

const STATUS_LABELS: Record<PhaseStatus, TranslationKey> = {
	pending: "kanbanStatus_pending",
	"in-progress": "kanbanStatus_in-progress",
	completed: "kanbanStatus_completed",
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
		<div
			className="group rounded-[2rem] bg-dash-border/20 p-1 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-dash-accent/5"
			style={{
				animation: "fade-in-up 0.8s cubic-bezier(0.32,0.72,0,1) 0.2s both",
			}}
		>
			<section className="rounded-[calc(2rem-0.25rem)] border border-white/5 bg-dash-surface p-6 shadow-2xl">
				<div className="mb-6 flex items-end justify-between px-2">
					<div>
						<h2 className="text-xl font-bold tracking-tight text-dash-text">
							{t("plansTimeline")}
						</h2>
						<p className="text-xs uppercase tracking-widest text-dash-text-muted mt-1">
							{t("plansTimelineAvgDays").replace(
								"{count}",
								timeline.summary.avgDurationDays.toFixed(1),
							)}
						</p>
					</div>
					<div className="flex gap-4">
						{(Object.entries(BAR_CLASS) as Array<[PhaseStatus, string]>).map(
							([status, classes]) => (
								<div key={status} className="flex items-center gap-2">
									<div
										className={`h-1.5 w-6 rounded-full bg-gradient-to-r ${classes.split(" ").slice(0, 2).join(" ")}`}
									/>
									<span className="text-[10px] font-bold uppercase tracking-wider text-dash-text-muted">
										{t(STATUS_LABELS[status])}
									</span>
								</div>
							),
						)}
					</div>
				</div>

				<div className="relative mt-8">
					<div className="grid grid-cols-7 gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-dash-text-muted/60">
						{axis.map((label) => (
							<span key={label}>{label}</span>
						))}
					</div>

					<div
						className="relative mt-4 min-h-[160px] overflow-hidden rounded-2xl border border-white/5 bg-dash-bg/30 p-4 transition-all duration-500 group-hover:bg-dash-bg/50"
						style={{ height: `${Math.max(160, timeline.layerCount * 40 + 64)}px` }}
					>
						{/* Grid lines */}
						<div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
							{Array.from({ length: 7 }).map((_, i) => (
								<div key={i} className="h-full border-r border-white-[0.02] last:border-0" />
							))}
						</div>

						{/* Today Indicator */}
						<div
							className="absolute bottom-0 top-0 z-10 w-px bg-dash-accent/40"
							style={{ left: `${timeline.todayPct}%` }}
						>
							<div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-dash-accent shadow-[0_0_8px_theme(colors.dash-accent)]" />
						</div>

						{/* Phases */}
						{timeline.phases.map((phase) => (
							<button
								key={phase.phaseId}
								type="button"
								onClick={() => onOpenPhase(phase.file)}
								title={`${phase.name} • ${phase.effort ?? t("plansNoEffort")}`}
								className={`absolute flex h-7 items-center rounded-lg border px-3 text-[11px] font-semibold text-white backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:brightness-110 active:scale-[0.98] bg-gradient-to-r ${BAR_CLASS[phase.status]}`}
								style={{
									top: `${phase.layer * 38 + 20}px`,
									left: `${phase.leftPct}%`,
									width: `${phase.widthPct}%`,
								}}
							>
								<span className="truncate drop-shadow-sm">
									{phase.phaseId} · {phase.name}
								</span>
							</button>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
