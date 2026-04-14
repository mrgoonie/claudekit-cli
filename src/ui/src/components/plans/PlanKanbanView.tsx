import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n";
import type { PlanListItem } from "../../types/plan-dashboard-types";
import type { PlanBoardStatus } from "../../types/plan-types";
import PlanCard from "./PlanCard";

const COLUMNS: Array<{ status: PlanBoardStatus; color: string; labelKey: TranslationKey }> = [
	{ status: "pending", color: "bg-amber-400/80", labelKey: "plansStatusPending" },
	{ status: "in-progress", color: "bg-sky-400/80", labelKey: "plansStatusInProgress" },
	{ status: "in-review", color: "bg-violet-400/80", labelKey: "plansStatusInReview" },
	{ status: "done", color: "bg-emerald-400/80", labelKey: "plansStatusDone" },
	{ status: "cancelled", color: "bg-rose-400/80", labelKey: "plansStatusCancelled" },
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
		<div className="grid h-full w-full gap-6 lg:grid-cols-3 xl:grid-cols-5">
			{COLUMNS.map((column, idx) => {
				const items = plans.filter((plan) => (plan.summary.status ?? "pending") === column.status);
				return (
					<div
						key={column.status}
						className="group/col flex flex-col rounded-[2.5rem] bg-dash-border/10 p-2 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-dash-border/20"
						style={{
							animation: `fade-in-up 0.8s cubic-bezier(0.32,0.72,0,1) ${idx * 0.1}s both`,
						}}
					>
						<section className="flex flex-1 flex-col rounded-[calc(2.5rem-0.5rem)] border border-white/5 bg-dash-bg/40 p-3 shadow-2xl backdrop-blur-sm">
							<header className="mb-6 flex items-center justify-between px-2 pt-2">
								<div className="flex items-center gap-3">
									<div
										className={`h-2.5 w-2.5 rounded-full ${column.color} shadow-[0_0_12px_rgba(255,255,255,0.1)]`}
									/>
									<h2 className="text-xs font-bold uppercase tracking-[0.15em] text-dash-text">
										{t(column.labelKey)}
									</h2>
								</div>
								<div className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-dash-border px-2 text-[10px] font-bold text-dash-text-muted transition-colors group-hover/col:bg-dash-accent group-hover/col:text-white">
									{items.length}
								</div>
							</header>

							<div className="space-y-4 overflow-y-auto px-1 pb-4 scrollbar-hide">
								{items.length > 0 ? (
									items.map((plan) => (
										<PlanCard
											key={`${plan.projectId ?? "plan"}:${plan.slug}`}
											plan={plan}
											compact
											onClick={() => onSelect(plan)}
										/>
									))
								) : (
									<div className="flex flex-col items-center justify-center py-12 text-center opacity-20">
										<div className="mb-2 h-1 w-8 rounded-full bg-dash-border" />
										<p className="text-[10px] font-medium uppercase tracking-widest text-dash-text-muted">
											{t("plansKanbanEmpty")}
										</p>
									</div>
								)}
							</div>
						</section>
					</div>
				);
			})}
		</div>
	);
}
