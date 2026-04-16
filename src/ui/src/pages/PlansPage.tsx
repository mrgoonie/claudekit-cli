import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DesktopModeNotice from "../components/desktop-mode-notice";
import PlanCard from "../components/plans/PlanCard";
import PlanKanbanView from "../components/plans/PlanKanbanView";
import PlanSearchBar from "../components/plans/PlanSearchBar";
import ProjectPlansGroup from "../components/plans/ProjectPlansGroup";
import { usePlansDashboard } from "../hooks/use-plans-dashboard";
import { isTauri } from "../hooks/use-tauri";
import { useI18n } from "../i18n";
import type {
	PlanDashboardViewMode,
	PlanListItem,
	PlanSortOption,
} from "../types/plan-dashboard-types";
import type { PlanBoardStatus } from "../types/plan-types";

function isCompletedPlan(plan: PlanListItem): boolean {
	return plan.summary.status === "done" || plan.summary.status === "cancelled";
}

function readStoredViewMode(): PlanDashboardViewMode {
	const stored = localStorage.getItem("ck-plans-view");
	return stored === "kanban" || stored === "grid" ? stored : "grid";
}

function readViewMode(searchParams: URLSearchParams): PlanDashboardViewMode {
	const view = searchParams.get("view");
	if (view === "kanban" || view === "grid") return view;
	return readStoredViewMode();
}

function PlansPageContent() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const rootDir = searchParams.get("dir") ?? "plans";
	const projectId = searchParams.get("projectId");
	const isGlobalView = !projectId;
	const { plans, projectOptions, projectErrors, loading, error } = usePlansDashboard(
		rootDir,
		projectId,
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [viewMode, setViewMode] = useState<PlanDashboardViewMode>(() => readViewMode(searchParams));
	const [sortBy, setSortBy] = useState<PlanSortOption>("date-desc");
	const [statusFilter, setStatusFilter] = useState<PlanBoardStatus | "all">("all");
	const [projectFilter, setProjectFilter] = useState("all");

	useEffect(() => {
		setViewMode(readViewMode(searchParams));
	}, [searchParams]);

	const filteredPlans = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		return [...plans]
			.filter((plan) => (projectFilter === "all" ? true : plan.projectId === projectFilter))
			.filter((plan) =>
				statusFilter === "all" ? true : (plan.summary.status ?? "pending") === statusFilter,
			)
			.filter((plan) =>
				query
					? [
							plan.summary.title,
							plan.summary.description,
							plan.projectName,
							plan.slug,
							(plan.summary.tags ?? []).join(" "),
						]
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
	}, [plans, projectFilter, searchQuery, sortBy, statusFilter]);

	const groupedPlans = useMemo(() => {
		const groups = new Map<
			string,
			{
				key: string;
				projectName: string;
				activePlans: PlanListItem[];
				completedPlans: PlanListItem[];
			}
		>();
		for (const plan of filteredPlans) {
			const key = plan.projectId ?? plan.projectName ?? "current-project";
			const projectName = plan.projectName ?? t("plansTitle");
			const group = groups.get(key) ?? {
				key,
				projectName,
				activePlans: [],
				completedPlans: [],
			};
			if (isCompletedPlan(plan)) {
				group.completedPlans.push(plan);
			} else {
				group.activePlans.push(plan);
			}
			groups.set(key, group);
		}
		return Array.from(groups.values());
	}, [filteredPlans, t]);

	const openPlan = (plan: PlanListItem) => {
		const nextRootDir = plan.plansDir ?? rootDir;
		const nextProjectId = plan.projectId ?? projectId;
		navigate(
			`/plans/${encodeURIComponent(plan.slug)}?dir=${encodeURIComponent(nextRootDir)}${
				nextProjectId ? `&projectId=${encodeURIComponent(nextProjectId)}` : ""
			}${isGlobalView ? "&origin=global" : ""}`,
		);
	};

	const onViewModeChange = (value: PlanDashboardViewMode) => {
		localStorage.setItem("ck-plans-view", value);
		setViewMode(value);
		const nextSearchParams = new URLSearchParams(searchParams);
		if (value === "grid") {
			nextSearchParams.delete("view");
		} else {
			nextSearchParams.set("view", value);
		}
		setSearchParams(nextSearchParams, { replace: true });
	};

	return (
		<div className="flex h-full flex-col gap-4 overflow-auto">
			<header>
				<p className="text-xs uppercase tracking-[0.2em] text-dash-text-muted">
					{t("toolsSection")}
				</p>
				<h1 className="mt-2 text-2xl font-semibold text-dash-text">
					{isGlobalView ? t("plansGlobalTitle") : t("plansTitle")}
				</h1>
				<p className="mt-2 text-sm text-dash-text-muted">{t("plansSubtitle")}</p>
			</header>
			<PlanSearchBar
				searchQuery={searchQuery}
				viewMode={viewMode}
				sortBy={sortBy}
				statusFilter={statusFilter}
				projectFilter={isGlobalView ? projectFilter : undefined}
				projectOptions={isGlobalView ? projectOptions : undefined}
				onSearchQueryChange={setSearchQuery}
				onViewModeChange={onViewModeChange}
				onSortByChange={setSortBy}
				onStatusFilterChange={setStatusFilter}
				onProjectFilterChange={isGlobalView ? setProjectFilter : undefined}
			/>
			{loading && <p className="text-sm text-dash-text-muted">{t("loading")}</p>}
			{error && (
				<p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
					{error}
				</p>
			)}
			{!loading && !error && projectErrors.length > 0 && (
				<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
					<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
						{t("plansProjectLoadIssues")}
					</p>
					<div className="mt-2 space-y-1">
						{projectErrors.map((project) => (
							<p key={project.id}>
								<span className="font-semibold">{project.name}</span>: {project.error}
							</p>
						))}
					</div>
				</div>
			)}
			{!loading && !error && filteredPlans.length === 0 && (
				<p className="rounded-xl border border-dash-border bg-dash-surface p-8 text-sm text-dash-text-muted">
					{t("plansEmpty")}
				</p>
			)}
			{!loading && !error && filteredPlans.length > 0 && viewMode === "grid" && !isGlobalView && (
				<div className="grid gap-4 xl:grid-cols-3">
					{filteredPlans.map((plan) => (
						<PlanCard key={plan.slug} plan={plan} onClick={() => openPlan(plan)} />
					))}
				</div>
			)}
			{!loading && !error && filteredPlans.length > 0 && viewMode === "grid" && isGlobalView && (
				<div className="space-y-6">
					{groupedPlans.map((group) => (
						<ProjectPlansGroup
							key={group.key}
							projectName={group.projectName}
							activePlans={group.activePlans}
							completedPlans={group.completedPlans}
							onPlanClick={openPlan}
						/>
					))}
				</div>
			)}
			{!loading && !error && filteredPlans.length > 0 && viewMode === "kanban" && (
				<PlanKanbanView plans={filteredPlans} onSelect={openPlan} />
			)}
		</div>
	);
}

export default function PlansPage() {
	if (isTauri()) {
		return (
			<DesktopModeNotice
				titleKey="desktopModePlansTitle"
				descriptionKey="desktopModePlansDescription"
				commandHintKey="desktopModePlansHint"
			/>
		);
	}

	return <PlansPageContent />;
}
