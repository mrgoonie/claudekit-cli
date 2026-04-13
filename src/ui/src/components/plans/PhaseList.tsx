import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { PlanActionResult } from "../../types/plan-dashboard-types";
import type { PhaseStatus, PlanPhase } from "../../types/plan-types";
import PhaseActions from "./PhaseActions";

const STATUS_INDICATOR: Record<PhaseStatus, string> = {
	pending: "bg-amber-500",
	"in-progress": "bg-sky-500",
	completed: "bg-emerald-500",
};

const STATUS_LABELS: Record<PhaseStatus, TranslationKey> = {
	pending: "kanbanStatus_pending",
	"in-progress": "kanbanStatus_in-progress",
	completed: "kanbanStatus_completed",
};

export default function PhaseList({
	planDir,
	phases,
	actions,
	onRead,
	onRefresh,
}: {
	planDir: string;
	phases: PlanPhase[];
	actions: PlanActionResult;
	onRead: (file: string) => void;
	onRefresh: () => void;
}) {
	const { t } = useI18n();
	return (
		<div
			className="rounded-[2rem] bg-dash-border/20 p-1"
			style={{
				animation: "fade-in-up 0.8s cubic-bezier(0.32,0.72,0,1) 0.4s both",
			}}
		>
			<section className="rounded-[calc(2rem-0.25rem)] border border-white/5 bg-dash-surface p-6 shadow-2xl">
				<div className="mb-6 flex items-center justify-between px-2">
					<h2 className="text-xl font-bold tracking-tight text-dash-text">{t("plansPhases")}</h2>
					<span className="text-[10px] font-bold uppercase tracking-widest text-dash-text-muted bg-dash-bg px-2 py-1 rounded-md border border-white/5">
						{t("plansPhaseCount").replace("{count}", String(phases.length))}
					</span>
				</div>
				<div className="space-y-4">
					{phases.map((phase, idx) => (
						<div
							key={phase.phaseId}
							className="group relative rounded-[1.5rem] bg-dash-border/10 p-1 transition-all duration-500 hover:bg-dash-accent/5"
							style={{
								animation: `fade-in-up 0.6s cubic-bezier(0.32,0.72,0,1) ${0.5 + idx * 0.1}s both`,
							}}
						>
							<div className="flex flex-col gap-4 rounded-[calc(1.5rem-0.25rem)] border border-white/5 bg-dash-bg p-4 transition-colors duration-500 hover:bg-dash-bg/80 lg:flex-row lg:items-center lg:justify-between">
								<div className="flex items-start gap-4">
									<div className="mt-1 flex flex-col items-center gap-2">
										<div
											className={`h-3 w-3 rounded-full ${STATUS_INDICATOR[phase.status]} shadow-[0_0_8px_currentColor]`}
										/>
										<div className="h-full w-px flex-1 bg-dash-border/30" />
									</div>
									<div>
										<div className="flex items-center gap-2">
											<span className="text-[10px] font-bold uppercase tracking-[0.2em] text-dash-accent/80">
												{phase.phaseId}
											</span>
										</div>
										<h3 className="text-sm font-semibold text-dash-text group-hover:text-dash-accent transition-colors">
											{phase.name}
										</h3>
										<p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-dash-text-muted">
											{t(STATUS_LABELS[phase.status])}
										</p>
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-3">
									<button
										type="button"
										onClick={() => onRead(phase.file)}
										className="flex h-8 items-center rounded-full border border-white/10 bg-dash-surface px-4 text-[11px] font-bold uppercase tracking-widest text-dash-text transition-all duration-300 hover:bg-dash-accent hover:text-white active:scale-95"
									>
										{t("plansRead")}
									</button>
									<div className="p-0.5 bg-dash-border/20 rounded-full border border-white/5">
										<PhaseActions
											planDir={planDir}
											phaseId={phase.phaseId}
											status={phase.status}
											actions={actions}
											onSuccess={onRefresh}
										/>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
