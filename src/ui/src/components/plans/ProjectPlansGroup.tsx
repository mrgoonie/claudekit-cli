import { useI18n } from "../../i18n";
import type { PlanListItem } from "../../types/plan-dashboard-types";
import PlanCard from "./PlanCard";

interface ProjectPlansGroupProps {
	projectName: string;
	activePlans: PlanListItem[];
	completedPlans: PlanListItem[];
	onPlanClick: (plan: PlanListItem) => void;
}

export default function ProjectPlansGroup(props: ProjectPlansGroupProps) {
	const { t } = useI18n();
	const totalPlans = props.activePlans.length + props.completedPlans.length;

	return (
		<section className="space-y-4 rounded-[2rem] border border-dash-border bg-dash-surface/70 p-5">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-dash-text">{props.projectName}</h2>
					<p className="text-xs text-dash-text-muted">
						{t("plansProjectPlans").replace("{count}", String(totalPlans))}
					</p>
				</div>
				<div className="rounded-full border border-dash-border bg-dash-bg px-3 py-1 text-xs font-semibold text-dash-text-muted">
					{totalPlans}
				</div>
			</div>

			<div className="grid gap-4 xl:grid-cols-3">
				{props.activePlans.map((plan) => (
					<PlanCard key={plan.slug} plan={plan} onClick={() => props.onPlanClick(plan)} />
				))}
			</div>

			{props.completedPlans.length > 0 && (
				<details className="rounded-[1.5rem] border border-dash-border/80 bg-dash-bg/40 p-4">
					<summary className="cursor-pointer select-none text-sm font-medium text-dash-text-muted">
						{t("plansCompletedCount").replace("{count}", String(props.completedPlans.length))}
					</summary>
					<div className="mt-4 grid gap-4 xl:grid-cols-3">
						{props.completedPlans.map((plan) => (
							<div key={plan.slug} className="opacity-60">
								<PlanCard plan={plan} onClick={() => props.onPlanClick(plan)} />
							</div>
						))}
					</div>
				</details>
			)}
		</section>
	);
}
