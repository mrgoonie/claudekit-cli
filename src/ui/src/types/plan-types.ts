/**
 * Plan domain types for the UI layer.
 * Mirrors the backend PlanPhase shape from src/domains/plan-parser/plan-types.ts
 */

export type PhaseStatus = "completed" | "in-progress" | "pending";

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
	status?: string;
	totalPhases: number;
	completed: number;
	inProgress: number;
	pending: number;
	phases: PlanPhase[];
}
