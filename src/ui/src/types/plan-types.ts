export type PhaseStatus = "completed" | "in-progress" | "pending";
export type PlanBoardStatus = "pending" | "in-progress" | "in-review" | "done" | "cancelled";

export interface PlanPhase {
	phase: number;
	phaseId: string;
	name: string;
	status: PhaseStatus;
	file: string;
	linkText: string;
	anchor: string | null;
}

export interface PlanSummary {
	planDir: string;
	planFile: string;
	title?: string;
	description?: string;
	status?: PlanBoardStatus;
	priority?: "P1" | "P2" | "P3";
	effort?: string;
	branch?: string;
	tags: string[];
	blockedBy: string[];
	blocks: string[];
	created?: string;
	lastModified?: string;
	totalPhases: number;
	completed: number;
	inProgress: number;
	pending: number;
	progressPct: number;
	phases: PlanPhase[];
}

export interface ProjectActivePlan {
	planDir: string;
	planFile: string;
	title?: string;
	description?: string;
	status?: PlanBoardStatus;
	priority?: "P1" | "P2" | "P3";
	effort?: string;
	branch?: string;
	tags: string[];
	blockedBy: string[];
	blocks: string[];
	created?: string;
	lastModified?: string;
	totalPhases: number;
	completed: number;
	inProgress: number;
	pending: number;
	progressPct: number;
}

export interface TimelinePhase {
	phaseId: string;
	name: string;
	status: PhaseStatus;
	file: string;
	effort?: string;
	startDate: string | null;
	endDate: string | null;
	layer: number;
	leftPct: number;
	widthPct: number;
}

export interface TimelineData {
	rangeStart: string;
	rangeEnd: string;
	today: string;
	todayPct: number;
	layerCount: number;
	phases: TimelinePhase[];
	summary: {
		totalEffortHours: number;
		avgDurationDays: number;
		completionRate: number;
	};
}

export interface HeatmapCell {
	date: string;
	weekIndex: number;
	dayIndex: number;
	commitCount: number;
	fileModCount: number;
	totalActivity: number;
	level: 0 | 1 | 2 | 3;
	files: string[];
}

export interface HeatmapData {
	rangeStart: string;
	rangeEnd: string;
	source: "git" | "mtime" | "both";
	maxActivity: number;
	cells: HeatmapCell[];
	error?: string;
}

export interface PlanActionStatus {
	id: string;
	action: "complete" | "start" | "reset" | "validate" | "start-next";
	planDir: string;
	phaseId?: string;
	timestamp: string;
	status: "pending" | "processing" | "completed" | "failed";
	result?: Record<string, unknown>;
	error?: string;
}

export interface PlanFileResponse {
	file: string;
	frontmatter: Record<string, unknown>;
	content: string;
	raw: string;
}
