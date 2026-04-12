import { useI18n } from "../../i18n";
import type { PlanActionResult } from "../../types/plan-dashboard-types";
import type { PlanSummary } from "../../types/plan-types";
import PlanActions from "./PlanActions";

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
	return (
		<section className="rounded-xl border border-dash-border bg-dash-surface p-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.2em] text-dash-text-muted">{plan.status}</p>
					<h1 className="mt-2 text-2xl font-semibold text-dash-text">{plan.title}</h1>
					{plan.description && (
						<p className="mt-2 max-w-2xl text-sm text-dash-text-muted">{plan.description}</p>
					)}
				</div>
				<PlanActions planDir={planDir} actions={actions} onSuccess={onActionSuccess} />
			</div>
			<div className="mt-4 h-2 rounded-full bg-dash-bg">
				<div
					className="h-2 rounded-full bg-dash-accent"
					style={{ width: `${plan.progressPct}%` }}
				/>
			</div>
			<div className="mt-4 grid gap-3 text-sm text-dash-text-muted sm:grid-cols-4">
				<span>{t("plansPhaseCount").replace("{count}", String(plan.totalPhases))}</span>
				<span>{t("plansProgressComplete").replace("{count}", String(plan.progressPct))}</span>
				<span>{t("plansPriorityLabel").replace("{value}", plan.priority ?? "—")}</span>
				<span>
					{t("plansUpdatedLabel").replace(
						"{value}",
						plan.lastModified ? new Date(plan.lastModified).toLocaleDateString() : "—",
					)}
				</span>
			</div>
		</section>
	);
}
