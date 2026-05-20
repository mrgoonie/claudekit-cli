import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { PlanActionResult } from "../../types/plan-dashboard-types";
import type { PlanBoardStatus, PlanSummary } from "../../types/plan-types";
import PlanActions from "./PlanActions";

const STATUS_LABELS: Record<PlanBoardStatus, TranslationKey> = {
	pending: "plansStatusPending",
	"in-progress": "plansStatusInProgress",
	"in-review": "plansStatusInReview",
	done: "plansStatusDone",
	cancelled: "plansStatusCancelled",
};

export default function PlanHeader({
	plan,
	planDir,
	actions,
	onActionSuccess,
}: {
	plan: PlanSummary;
	planDir: string;
	actions: PlanActionResult;
	onActionSuccess: () => void;
}) {
	const { t } = useI18n();
	const status = plan.status ?? "pending";
	return (
		<div
			className="rounded-[2rem] bg-dash-border/20 p-1 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
			style={{
				animation: "fade-in-up 0.8s cubic-bezier(0.32,0.72,0,1) both",
			}}
		>
			<section className="rounded-[calc(2rem-0.25rem)] border border-white/5 bg-dash-surface p-6 shadow-2xl">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
					<div className="flex-1">
						<div className="mb-2 flex items-center gap-3">
							<span className="rounded-full bg-dash-accent/10 border border-dash-accent/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-dash-accent">
								{t(STATUS_LABELS[status])}
							</span>
							<span className="text-[10px] font-medium uppercase tracking-[0.2em] text-dash-text-muted">
								{t("plansLabel")}
							</span>
						</div>
						<h1 className="text-3xl font-bold tracking-tight text-dash-text lg:text-4xl text-balance">
							{plan.title}
						</h1>
						{plan.description && (
							<p className="mt-4 max-w-3xl text-sm leading-relaxed text-dash-text-muted">
								{plan.description}
							</p>
						)}
					</div>
					<div className="shrink-0 p-1 bg-dash-border/10 rounded-2xl border border-white/5">
						<PlanActions planDir={planDir} actions={actions} onSuccess={onActionSuccess} />
					</div>
				</div>

				<div className="mt-8">
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-bold uppercase tracking-widest text-dash-text-muted">
							{t("kanbanProgress")}
						</span>
						<span className="text-sm font-bold text-dash-accent">{plan.progressPct}%</span>
					</div>
					<div className="h-2 w-full overflow-hidden rounded-full bg-dash-bg shadow-inner">
						<div
							className="h-full rounded-full bg-gradient-to-r from-dash-accent/40 via-dash-accent to-dash-accent shadow-[0_0_12px_theme(colors.dash-accent/0.3)] transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]"
							style={{ width: `${plan.progressPct}%` }}
						/>
					</div>
				</div>

				<div className="mt-8 flex flex-wrap gap-6 border-t border-white/5 pt-6">
					<div className="flex flex-col gap-1">
						<span className="text-[10px] uppercase tracking-widest text-dash-text-muted">
							{t("plansPhase")}
						</span>
						<span className="text-sm font-semibold text-dash-text">
							{t("plansPhaseCount").replace("{count}", String(plan.totalPhases))}
						</span>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-[10px] uppercase tracking-widest text-dash-text-muted">
							{t("plansPriority")}
						</span>
						<span className="text-sm font-semibold text-dash-text">{plan.priority ?? "—"}</span>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-[10px] uppercase tracking-widest text-dash-text-muted">
							{t("plansLastUpdated")}
						</span>
						<span className="text-sm font-semibold text-dash-text">
							{plan.lastModified ? new Date(plan.lastModified).toLocaleDateString() : "—"}
						</span>
					</div>
				</div>
			</section>
		</div>
	);
}
