import { useI18n } from "../../i18n";
import type { PlanDashboardViewMode, PlanSortOption } from "../../types/plan-dashboard-types";
import type { PlanBoardStatus } from "../../types/plan-types";

interface PlanSearchBarProps {
	searchQuery: string;
	viewMode: PlanDashboardViewMode;
	sortBy: PlanSortOption;
	statusFilter: PlanBoardStatus | "all";
	onSearchQueryChange: (value: string) => void;
	onViewModeChange: (value: PlanDashboardViewMode) => void;
	onSortByChange: (value: PlanSortOption) => void;
	onStatusFilterChange: (value: PlanBoardStatus | "all") => void;
}

export default function PlanSearchBar(props: PlanSearchBarProps) {
	const { t } = useI18n();

	return (
		<div className="grid gap-3 rounded-xl border border-dash-border bg-dash-surface p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
			<input
				type="search"
				value={props.searchQuery}
				onChange={(event) => props.onSearchQueryChange(event.target.value)}
				placeholder={t("plansSearch")}
				className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none transition focus:border-dash-accent/60"
			/>
			<select
				value={props.statusFilter}
				onChange={(event) =>
					props.onStatusFilterChange(event.target.value as PlanBoardStatus | "all")
				}
				className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text"
			>
				<option value="all">{t("plansFilterAll")}</option>
				<option value="pending">{t("plansStatusPending")}</option>
				<option value="in-progress">{t("plansStatusInProgress")}</option>
				<option value="in-review">{t("plansStatusInReview")}</option>
				<option value="done">{t("plansStatusDone")}</option>
				<option value="cancelled">{t("plansStatusCancelled")}</option>
			</select>
			<select
				value={props.sortBy}
				onChange={(event) => props.onSortByChange(event.target.value as PlanSortOption)}
				className="rounded-lg border border-dash-border bg-dash-bg px-3 py-2 text-sm text-dash-text"
			>
				<option value="date-desc">{t("plansSortDateDesc")}</option>
				<option value="date-asc">{t("plansSortDateAsc")}</option>
				<option value="name-asc">{t("plansSortNameAsc")}</option>
				<option value="name-desc">{t("plansSortNameDesc")}</option>
				<option value="progress-desc">{t("plansSortProgress")}</option>
			</select>
			<div className="inline-flex rounded-lg border border-dash-border bg-dash-bg p-1">
				{(["grid", "kanban"] as const).map((mode) => (
					<button
						key={mode}
						type="button"
						onClick={() => props.onViewModeChange(mode)}
						className={[
							"rounded-md px-3 py-1.5 text-sm transition",
							props.viewMode === mode
								? "bg-dash-accent text-dash-bg"
								: "text-dash-text-muted hover:text-dash-text",
						].join(" ")}
					>
						{mode === "grid" ? t("plansViewGrid") : t("plansViewKanban")}
					</button>
				))}
			</div>
		</div>
	);
}
