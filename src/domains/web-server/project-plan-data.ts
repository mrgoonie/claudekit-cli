import { CkConfigManager } from "@/domains/config/index.js";
import {
	buildPlanSummaries,
	resolvePlanDirForScope,
	scanPlanDir,
} from "@/domains/plan-parser/index.js";
import type { PlanScope, PlanSummary } from "@/domains/plan-parser/plan-types.js";
import type { PlanValidationMode } from "@/types";

export type ProjectActivePlan = Omit<PlanSummary, "phases">;

export interface ProjectPlanSettings {
	scope: PlanScope;
	plansDir: string;
	validationMode: PlanValidationMode;
	activePlanCount: number;
}

function toProjectActivePlan({ phases: _phases, ...plan }: PlanSummary): ProjectActivePlan {
	return plan;
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
	try {
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
	} catch {
		return {
			planSettings: {
				scope,
				plansDir: "",
				validationMode: "prompt",
				activePlanCount: 0,
			},
			activePlans: [],
		};
	}
}
