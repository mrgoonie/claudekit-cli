/**
 * Plan Parser Domain — barrel export
 */
import { dirname } from "node:path";
import { parsePlanFile } from "./plan-table-parser.js";
import type { PlanSummary } from "./plan-types.js";

export {
	filenameToTitle,
	normalizeStatus,
	parsePlanFile,
	parsePlanPhases,
} from "./plan-table-parser.js";
export { validatePlanFile } from "./plan-validator.js";
export type {
	ParseOptions,
	PhaseStatus,
	PlanPhase,
	PlanSummary,
	ValidationIssue,
	ValidationResult,
} from "./plan-types.js";

/** Build a PlanSummary from a plan.md file path */
export function buildPlanSummary(planFile: string): PlanSummary {
	const { frontmatter, phases } = parsePlanFile(planFile);
	const completed = phases.filter((p) => p.status === "completed").length;
	const inProgress = phases.filter((p) => p.status === "in-progress").length;
	const pending = phases.filter((p) => p.status === "pending").length;
	return {
		planDir: dirname(planFile),
		planFile,
		title: frontmatter.title as string | undefined,
		description: frontmatter.description as string | undefined,
		status: frontmatter.status as string | undefined,
		totalPhases: phases.length,
		completed,
		inProgress,
		pending,
		phases,
	};
}
