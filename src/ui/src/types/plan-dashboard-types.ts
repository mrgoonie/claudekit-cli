import type { PlanActionStatus, PlanFileResponse, PlanSummary, TimelineData } from "./plan-types";

export type PlanDashboardViewMode = "grid" | "kanban";
export type PlanSortOption = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "progress-desc";

export interface PlanListItem {
	file: string;
	name: string;
	slug: string;
	summary: PlanSummary;
	projectId?: string;
	projectName?: string;
	plansDir?: string;
}

export interface PlansListResponse {
	dir: string;
	total: number;
	limit: number;
	offset: number;
	plans: PlanListItem[];
}

export interface ProjectPlanListItem {
	file: string;
	name: string;
	slug: string;
	summary: PlanSummary;
}

export interface ProjectPlansEntry {
	id: string;
	name: string;
	path: string;
	plansDir: string;
	error?: string;
	plans: ProjectPlanListItem[];
}

export interface MultiProjectPlansResponse {
	projects: ProjectPlansEntry[];
	totalPlans: number;
}

export interface ProjectFilterOption {
	id: string;
	name: string;
}

export interface ProjectScanError {
	id: string;
	name: string;
	error: string;
}

export interface PlanTimelineResponse {
	plan: PlanSummary;
	timeline: TimelineData;
}

export interface PlanNavigationItem {
	phaseId: string;
	name: string;
	file: string;
}

export interface PlanNavigationState {
	planTitle: string;
	phases: PlanNavigationItem[];
	currentIndex: number;
	prev: PlanNavigationItem | null;
	next: PlanNavigationItem | null;
	loading: boolean;
	error: string | null;
}

export interface PlanFileState extends PlanFileResponse {
	loading: boolean;
	error: string | null;
}

export interface PlanActionResult {
	trigger: (input: {
		action: PlanActionStatus["action"];
		planDir: string;
		phaseId?: string;
		projectId?: string;
	}) => Promise<PlanActionStatus>;
	pendingId: string | null;
	loading: boolean;
	error: string | null;
}
