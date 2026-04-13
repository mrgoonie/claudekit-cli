import { dirname, join } from "node:path";
import { buildPlanSummary, validatePlanFile } from "@/domains/plan-parser/index.js";
import {
	trackPhaseChecked,
	trackPhaseUnchecked,
	trackPlanCompleted,
} from "@/domains/plan-parser/plan-telemetry.js";
import { updatePhaseStatus } from "@/domains/plan-parser/plan-writer.js";
import {
	findProjectRoot,
	updateRegistryPhaseStatus,
} from "@/domains/plan-parser/plans-registry.js";
import type { PlanAction } from "./action-signal.js";

const PHASE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function getPlanFile(planDir: string): string {
	return join(planDir, "plan.md");
}

function assertPhaseId(phaseId: string | undefined): string {
	if (!phaseId) throw new Error("phaseId is required");
	if (!PHASE_ID_REGEX.test(phaseId)) throw new Error("Invalid phaseId");
	return phaseId;
}

function syncDashboardTracking(planFile: string): string {
	const summary = buildPlanSummary(planFile);
	try {
		const planDir = dirname(planFile);
		const projectRoot = findProjectRoot(planDir);
		updateRegistryPhaseStatus({
			planDir,
			planStatus: summary.status ?? "pending",
			progressPct: summary.progressPct,
			cwd: projectRoot,
		});
	} catch {
		// Registry update is non-critical; continue silently
	}
	return summary.status ?? "pending";
}

function trackDashboardCheck(planDir: string, phaseId: string, planStatus: string): void {
	try {
		trackPhaseChecked(planDir, phaseId, "dashboard");
		if (planStatus === "done") {
			trackPlanCompleted(planDir, "dashboard");
		}
	} catch {
		// Telemetry is non-critical; continue silently
	}
}

function trackDashboardUncheck(planDir: string, phaseId: string): void {
	try {
		trackPhaseUnchecked(planDir, phaseId, "dashboard");
	} catch {
		// Telemetry is non-critical; continue silently
	}
}

export async function executeAction(action: PlanAction): Promise<Record<string, unknown>> {
	const planFile = getPlanFile(action.planDir);
	switch (action.action) {
		case "complete": {
			const phaseId = assertPhaseId(action.phaseId);
			updatePhaseStatus(planFile, phaseId, "completed");
			const planStatus = syncDashboardTracking(planFile);
			trackDashboardCheck(action.planDir, phaseId, planStatus);
			return { success: true };
		}
		case "start": {
			const phaseId = assertPhaseId(action.phaseId);
			updatePhaseStatus(planFile, phaseId, "in-progress");
			const planStatus = syncDashboardTracking(planFile);
			trackDashboardCheck(action.planDir, phaseId, planStatus);
			return { success: true };
		}
		case "reset": {
			const phaseId = assertPhaseId(action.phaseId);
			updatePhaseStatus(planFile, phaseId, "pending");
			syncDashboardTracking(planFile);
			trackDashboardUncheck(action.planDir, phaseId);
			return { success: true };
		}
		case "validate":
			return { success: true, validation: validatePlanFile(planFile, false) };
		case "start-next": {
			const summary = buildPlanSummary(planFile);
			const nextPhase = summary.phases.find((phase) => phase.status === "pending");
			if (!nextPhase) return { success: true, message: "No pending phase found" };
			updatePhaseStatus(planFile, nextPhase.phaseId, "in-progress");
			const planStatus = syncDashboardTracking(planFile);
			trackDashboardCheck(action.planDir, nextPhase.phaseId, planStatus);
			return { success: true, phaseId: nextPhase.phaseId };
		}
		default:
			throw new Error(`Unsupported action: ${String(action.action)}`);
	}
}
