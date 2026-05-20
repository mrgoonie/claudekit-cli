/**
 * Plan Parser Domain — barrel export
 */
import { dirname } from "node:path";
import { readPlanMetadata } from "./plan-metadata.js";
import { parsePlanFile } from "./plan-table-parser.js";
import type { PlanSummary } from "./plan-types.js";

export {
	filenameToTitle,
	normalizeStatus,
	parsePlanFile,
	parsePlanPhases,
} from "./plan-table-parser.js";
export { buildHeatmapData } from "./activity-tracker.js";
export {
	normalizePhaseStatus,
	normalizePlanStatus,
	parseEffortHours,
	readPhaseMetadata,
	readPlanMetadata,
} from "./plan-metadata.js";
export { scanPlanDir } from "./plan-scanner.js";
export {
	inferPlanScopeForDir,
	parsePlanReference,
	resolveGlobalPlansDir,
	resolvePlanDirForScope,
	resolveProjectPlansDir,
} from "./plan-scope.js";
export { buildTimelineData } from "./timeline-builder.js";
export { validatePlanFile } from "./plan-validator.js";
export {
	scaffoldPlan,
	updatePhaseStatus,
	addPhase,
	generatePlanMd,
	generatePhaseTemplate,
	phaseNameToFilename,
	nextSubPhaseId,
} from "./plan-writer.js";
export type {
	ParseOptions,
	PhaseInput,
	PhaseStatus,
	PlanPhase,
	PlanSummary,
	CreatePlanOptions,
	HeatmapCell,
	HeatmapData,
	PlanBoardStatus,
	PlanScope,
	ValidationIssue,
	ValidationResult,
	TimelineData,
	TimelinePhase,
} from "./plan-types.js";

/** Build a PlanSummary from a plan.md file path */
export function buildPlanSummary(planFile: string): PlanSummary {
	const { frontmatter, phases } = parsePlanFile(planFile);
	const completed = phases.filter((p) => p.status === "completed").length;
	const inProgress = phases.filter((p) => p.status === "in-progress").length;
	const pending = phases.filter((p) => p.status === "pending").length;
	const metadata = readPlanMetadata(planFile, { total: phases.length, completed, inProgress });
	return {
		planDir: dirname(planFile),
		planFile,
		title:
			metadata.title ?? (typeof frontmatter.title === "string" ? frontmatter.title : undefined),
		description:
			metadata.description ??
			(typeof frontmatter.description === "string" ? frontmatter.description : undefined),
		status: metadata.status,
		priority: metadata.priority,
		effort: metadata.effort,
		branch: metadata.branch,
		tags: metadata.tags,
		blockedBy: metadata.blockedBy,
		blocks: metadata.blocks,
		created: metadata.created,
		lastModified: metadata.lastModified,
		totalPhases: phases.length,
		completed,
		inProgress,
		pending,
		progressPct: phases.length === 0 ? 0 : Math.round((completed / phases.length) * 100),
		phases,
	};
}

export function buildPlanSummaries(planFiles: string[]): PlanSummary[] {
	return planFiles.flatMap((planFile) => {
		try {
			return [buildPlanSummary(planFile)];
		} catch {
			return [];
		}
	});
}
