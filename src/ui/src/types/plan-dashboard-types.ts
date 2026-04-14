import type { PlanActionStatus, PlanFileResponse, PlanSummary, TimelineData } from "./plan-types";

export type PlanDashboardViewMode = "grid" | "kanban";
export type PlanSortOption = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "progress-desc";

export interface PlanListItem {
	file: string;
	name: string;
	slug: string;
	summary: PlanSummary;
}

export interface PlansListResponse {
	dir: string;
	total: number;
	limit: number;
	offset: number;
	plans: PlanListItem[];
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
