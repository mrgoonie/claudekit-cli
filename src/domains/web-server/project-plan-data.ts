import { CkConfigManager } from "@/domains/config/index.js";
import {
	buildPlanSummaries,
	resolvePlanDirForScope,
	scanPlanDir,
} from "@/domains/plan-parser/index.js";
import type { PlanSummary } from "@/domains/plan-parser/plan-types.js";
import type { PlanScope } from "@/domains/plan-parser/plan-types.js";
import type { PlanValidationMode } from "@/types";

export interface ProjectActivePlan {
	planDir: string;
	planFile: string;
	title?: string;
	description?: string;
	status?: PlanSummary["status"];
	priority?: PlanSummary["priority"];
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

export interface ProjectPlanSettings {
	scope: PlanScope;
	plansDir: string;
	validationMode: PlanValidationMode;
	activePlanCount: number;
}

function toProjectActivePlan(plan: PlanSummary): ProjectActivePlan {
	return {
		planDir: plan.planDir,
		planFile: plan.planFile,
		title: plan.title,
		description: plan.description,
		status: plan.status,
		priority: plan.priority,
		effort: plan.effort,
		branch: plan.branch,
		tags: plan.tags,
		blockedBy: plan.blockedBy,
		blocks: plan.blocks,
		created: plan.created,
		lastModified: plan.lastModified,
		totalPhases: plan.totalPhases,
		completed: plan.completed,
		inProgress: plan.inProgress,
		pending: plan.pending,
		progressPct: plan.progressPct,
	};
}

const ACTIVE_STATUS_ORDER: Record<string, number> = {
	"in-progress": 0,
	"in-review": 1,
	pending: 2,
	done: 3,
	cancelled: 4,
};

function sortActivePlans(a: PlanSummary, b: PlanSummary): number {
	const statusDiff =
		(ACTIVE_STATUS_ORDER[a.status ?? "pending"] ?? 9) -
		(ACTIVE_STATUS_ORDER[b.status ?? "pending"] ?? 9);
	if (statusDiff !== 0) return statusDiff;
	return b.progressPct - a.progressPct;
}

export async function buildProjectPlanData(
	projectPath: string | null,
	scope: PlanScope,
): Promise<{
	planSettings: ProjectPlanSettings;
	activePlans: ProjectActivePlan[];
}> {
	const { config } = await CkConfigManager.loadFull(scope === "global" ? null : projectPath);
	const plansDir = resolvePlanDirForScope(scope, projectPath ?? process.cwd(), config);
	const allPlans = buildPlanSummaries(scanPlanDir(plansDir));
	const activePlans = allPlans
		.filter((plan) => plan.status !== "done" && plan.status !== "cancelled")
		.sort(sortActivePlans);

	return {
		planSettings: {
			scope,
			plansDir,
			validationMode: config.plan?.validation?.mode ?? "prompt",
			activePlanCount: activePlans.length,
		},
		activePlans: activePlans.map(toProjectActivePlan),
	};
}
