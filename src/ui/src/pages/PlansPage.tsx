import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PlanCard from "../components/plans/PlanCard";
import PlanKanbanView from "../components/plans/PlanKanbanView";
import PlanSearchBar from "../components/plans/PlanSearchBar";
import { usePlansDashboard } from "../hooks/use-plans-dashboard";
import { useI18n } from "../i18n";
import type { PlanSortOption } from "../types/plan-dashboard-types";
import type { PlanBoardStatus } from "../types/plan-types";

export default function PlansPage() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const rootDir = searchParams.get("dir") ?? "plans";
	const projectId = searchParams.get("projectId");
	const { plans, loading, error } = usePlansDashboard(rootDir, projectId);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<"grid" | "kanban">(
		() => (localStorage.getItem("ck-plans-view") as "grid" | "kanban") ?? "grid",
	);
	const [sortBy, setSortBy] = useState<PlanSortOption>("date-desc");
	const [statusFilter, setStatusFilter] = useState<PlanBoardStatus | "all">("all");

	const filteredPlans = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		return [...plans]
			.filter((plan) =>
				statusFilter === "all" ? true : (plan.summary.status ?? "pending") === statusFilter,
			)
			.filter((plan) =>
				query
					? [plan.summary.title, plan.summary.description, plan.summary.tags.join(" ")]
							.filter(Boolean)
							.join(" ")
							.toLowerCase()
							.includes(query)
					: true,
			)
			.sort((left, right) => {
				switch (sortBy) {
					case "name-asc":
						return (left.summary.title ?? left.name).localeCompare(
							right.summary.title ?? right.name,
						);
					case "name-desc":
						return (right.summary.title ?? right.name).localeCompare(
							left.summary.title ?? left.name,
						);
					case "date-asc":
						return (left.summary.lastModified ?? "").localeCompare(
							right.summary.lastModified ?? "",
						);
					case "progress-desc":
						return right.summary.progressPct - left.summary.progressPct;
					default:
						return (right.summary.lastModified ?? "").localeCompare(
							left.summary.lastModified ?? "",
						);
				}
			});
	}, [plans, searchQuery, sortBy, statusFilter]);

	const openPlan = (slug: string) =>
		navigate(
			`/plans/${encodeURIComponent(slug)}?dir=${encodeURIComponent(rootDir)}${
				projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
			}`,
		);
	const onViewModeChange = (value: "grid" | "kanban") => {
		localStorage.setItem("ck-plans-view", value);
		setViewMode(value);
	};

	return (
		<div className="flex h-full flex-col gap-4 overflow-auto">
			<header>
				<p className="text-xs uppercase tracking-[0.2em] text-dash-text-muted">
					{t("toolsSection")}
				</p>
				<h1 className="mt-2 text-2xl font-semibold text-dash-text">{t("plansTitle")}</h1>
				<p className="mt-2 text-sm text-dash-text-muted">{t("plansSubtitle")}</p>
			</header>
			<PlanSearchBar
				searchQuery={searchQuery}
				viewMode={viewMode}
				sortBy={sortBy}
				statusFilter={statusFilter}
				onSearchQueryChange={setSearchQuery}
				onViewModeChange={onViewModeChange}
				onSortByChange={setSortBy}
				onStatusFilterChange={setStatusFilter}
			/>
			{loading && <p className="text-sm text-dash-text-muted">{t("loading")}</p>}
			{error && (
				<p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
					{error}
				</p>
			)}
			{!loading && !error && filteredPlans.length === 0 && (
				<p className="rounded-xl border border-dash-border bg-dash-surface p-8 text-sm text-dash-text-muted">
					{t("plansEmpty")}
				</p>
			)}
			{!loading && !error && filteredPlans.length > 0 && viewMode === "grid" && (
				<div className="grid gap-4 xl:grid-cols-3">
					{filteredPlans.map((plan) => (
						<PlanCard key={plan.slug} plan={plan} onClick={() => openPlan(plan.slug)} />
					))}
				</div>
			)}
			{!loading && !error && filteredPlans.length > 0 && viewMode === "kanban" && (
				<PlanKanbanView plans={filteredPlans} onSelect={(plan) => openPlan(plan.slug)} />
			)}
		</div>
	);
}
