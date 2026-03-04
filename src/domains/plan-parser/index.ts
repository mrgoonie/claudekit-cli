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
	parsePhasesFromBody,
	parsePlanPhases,
} from "./plan-table-parser.js";
export { scanPlanDir } from "./plan-scanner.js";
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
		title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
		description: typeof frontmatter.description === "string" ? frontmatter.description : undefined,
		status: typeof frontmatter.status === "string" ? frontmatter.status : undefined,
		totalPhases: phases.length,
		completed,
		inProgress,
		pending,
		phases,
	};
}
