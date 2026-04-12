import { useI18n } from "../../i18n";
import type { PlanListItem } from "../../types/plan-dashboard-types";
import type { PlanBoardStatus } from "../../types/plan-types";
import PlanCard from "./PlanCard";

const COLUMNS: Array<{ status: PlanBoardStatus; color: string; labelKey: string }> = [
	{ status: "pending", color: "border-amber-400", labelKey: "plansStatusPending" },
	{ status: "in-progress", color: "border-sky-400", labelKey: "plansStatusInProgress" },
	{ status: "in-review", color: "border-violet-400", labelKey: "plansStatusInReview" },
	{ status: "done", color: "border-emerald-400", labelKey: "plansStatusDone" },
	{ status: "cancelled", color: "border-rose-400", labelKey: "plansStatusCancelled" },
];

export default function PlanKanbanView({
	plans,
	onSelect,
}: {
	plans: PlanListItem[];
	onSelect: (plan: PlanListItem) => void;
}) {
	const { t } = useI18n();
	return (
		<div className="grid gap-4 xl:grid-cols-5">
			{COLUMNS.map((column) => {
				const items = plans.filter((plan) => (plan.summary.status ?? "pending") === column.status);
				return (
					<section
						key={column.status}
						className="rounded-xl border border-dash-border bg-dash-bg/50 p-3"
					>
						<header className={`mb-3 border-t-2 ${column.color} pt-3`}>
							<h2 className="text-sm font-semibold text-dash-text">
								{t(column.labelKey as never)}
							</h2>
							<p className="text-xs text-dash-text-muted">{items.length}</p>
						</header>
						<div className="space-y-3">
							{items.map((plan) => (
								<PlanCard key={plan.slug} plan={plan} compact onClick={() => onSelect(plan)} />
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
