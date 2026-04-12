import { join } from "node:path";
import { buildPlanSummary, validatePlanFile } from "@/domains/plan-parser/index.js";
import { updatePhaseStatus } from "@/domains/plan-parser/plan-writer.js";
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

export async function executeAction(action: PlanAction): Promise<Record<string, unknown>> {
	const planFile = getPlanFile(action.planDir);
	switch (action.action) {
		case "complete":
			updatePhaseStatus(planFile, assertPhaseId(action.phaseId), "completed");
			return { success: true };
		case "start":
			updatePhaseStatus(planFile, assertPhaseId(action.phaseId), "in-progress");
			return { success: true };
		case "reset":
			updatePhaseStatus(planFile, assertPhaseId(action.phaseId), "pending");
			return { success: true };
		case "validate":
			return { success: true, validation: validatePlanFile(planFile, false) };
		case "start-next": {
			const summary = buildPlanSummary(planFile);
			const nextPhase = summary.phases.find((phase) => phase.status === "pending");
			if (!nextPhase) return { success: true, message: "No pending phase found" };
			updatePhaseStatus(planFile, nextPhase.phaseId, "in-progress");
			return { success: true, phaseId: nextPhase.phaseId };
		}
		default:
			throw new Error(`Unsupported action: ${String(action.action)}`);
	}
}
