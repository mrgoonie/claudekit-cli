/**
 * Plan Parser Domain Types
 * Zod schemas for plan phases, validation, and summary structures
 */
import { z } from "zod";

export const PhaseStatusSchema = z.enum(["completed", "in-progress", "pending"]);
export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

export const PlanBoardStatusSchema = z.enum([
	"pending",
	"in-progress",
	"in-review",
	"done",
	"cancelled",
]);
export type PlanBoardStatus = z.infer<typeof PlanBoardStatusSchema>;

export const PlanScopeSchema = z.enum(["project", "global"]);
export type PlanScope = z.infer<typeof PlanScopeSchema>;

export const PlanPhaseSchema = z.object({
	phase: z.number().int().min(0),
	phaseId: z.string(), // raw ID: "1a", "2", "4b"
	name: z.string(),
	status: PhaseStatusSchema,
	file: z.string(), // absolute path
	linkText: z.string(),
	anchor: z.string().nullable(),
});
export type PlanPhase = z.infer<typeof PlanPhaseSchema>;

// Schemas are used for type inference — runtime validation via .parse() is not
// applied to parser outputs since they are internally constructed, not user input.
export const ParseOptionsSchema = z.object({
	generateAnchors: z.boolean().optional().default(false),
});
export type ParseOptions = z.infer<typeof ParseOptionsSchema>;

export const ValidationIssueSchema = z.object({
	line: z.number().int(),
	column: z.number().int().optional(),
	severity: z.enum(["error", "warning", "info"]),
	code: z.string(), // e.g. "filename-as-link-text"
	message: z.string(),
	fix: z.string().optional(), // suggested fix
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationResultSchema = z.object({
	file: z.string(),
	valid: z.boolean(),
	issues: z.array(ValidationIssueSchema),
	phases: z.array(PlanPhaseSchema),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const PhaseInputSchema = z.object({
	name: z.string().min(1),
	id: z.string().optional(), // auto-assigned if omitted
});
export type PhaseInput = z.infer<typeof PhaseInputSchema>;

export const PlanSourceSchema = z.enum(["skill", "cli", "dashboard"]);
export type PlanSource = z.infer<typeof PlanSourceSchema>;

export const CreatePlanOptionsSchema = z.object({
	title: z.string().min(1),
	phases: z.array(PhaseInputSchema).min(1),
	dir: z.string().min(1),
	priority: z.enum(["P1", "P2", "P3"]).optional(),
	issue: z.number().optional(),
	description: z.string().optional(),
	// Tracking metadata (CLI-strict plan tracking):
	source: PlanSourceSchema.optional(),
	sessionId: z.string().optional(),
});
export type CreatePlanOptions = z.infer<typeof CreatePlanOptionsSchema>;

export const PlanSummarySchema = z.object({
	planDir: z.string(),
	planFile: z.string(),
	title: z.string().optional(),
	description: z.string().optional(),
	status: PlanBoardStatusSchema.optional(),
	priority: z.enum(["P1", "P2", "P3"]).optional(),
	effort: z.string().optional(),
	branch: z.string().optional(),
	tags: z.array(z.string()).default([]),
	blockedBy: z.array(z.string()).default([]),
	blocks: z.array(z.string()).default([]),
	created: z.string().optional(),
	lastModified: z.string().optional(),
	totalPhases: z.number().int(),
	completed: z.number().int(),
	inProgress: z.number().int(),
	pending: z.number().int(),
	progressPct: z.number().int().min(0).max(100),
	phases: z.array(PlanPhaseSchema),
});
export type PlanSummary = z.infer<typeof PlanSummarySchema>;

export const ProjectPlanListItemSchema = z.object({
	file: z.string(),
	name: z.string(),
	slug: z.string(),
	summary: PlanSummarySchema,
});
export type ProjectPlanListItem = z.infer<typeof ProjectPlanListItemSchema>;

export const ProjectPlansEntrySchema = z.object({
	id: z.string(),
	name: z.string(),
	path: z.string(),
	plansDir: z.string(),
	error: z.string().optional(),
	plans: z.array(ProjectPlanListItemSchema),
});
export type ProjectPlansEntry = z.infer<typeof ProjectPlansEntrySchema>;

export const MultiProjectPlansResponseSchema = z.object({
	projects: z.array(ProjectPlansEntrySchema),
	totalPlans: z.number().int().min(0),
});
export type MultiProjectPlansResponse = z.infer<typeof MultiProjectPlansResponseSchema>;

export const TimelinePhaseSchema = z.object({
	phaseId: z.string(),
	name: z.string(),
	status: PhaseStatusSchema,
	file: z.string(),
	effort: z.string().optional(),
	startDate: z.string().nullable(),
	endDate: z.string().nullable(),
	layer: z.number().int().min(0),
	leftPct: z.number().min(0).max(100),
	widthPct: z.number().min(0).max(100),
});
export type TimelinePhase = z.infer<typeof TimelinePhaseSchema>;

export const TimelineDataSchema = z.object({
	rangeStart: z.string(),
	rangeEnd: z.string(),
	today: z.string(),
	todayPct: z.number().min(0).max(100),
	layerCount: z.number().int().min(0),
	phases: z.array(TimelinePhaseSchema),
	summary: z.object({
		totalEffortHours: z.number().min(0),
		avgDurationDays: z.number().min(0),
		completionRate: z.number().min(0).max(100),
	}),
});
export type TimelineData = z.infer<typeof TimelineDataSchema>;

export const HeatmapCellSchema = z.object({
	date: z.string(),
	weekIndex: z.number().int().min(0),
	dayIndex: z.number().int().min(0).max(6),
	commitCount: z.number().int().min(0),
	fileModCount: z.number().int().min(0),
	totalActivity: z.number().int().min(0),
	level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
	files: z.array(z.string()),
});
export type HeatmapCell = z.infer<typeof HeatmapCellSchema>;

export const HeatmapDataSchema = z.object({
	rangeStart: z.string(),
	rangeEnd: z.string(),
	source: z.enum(["git", "mtime", "both"]),
	maxActivity: z.number().int().min(0),
	cells: z.array(HeatmapCellSchema),
});
export type HeatmapData = z.infer<typeof HeatmapDataSchema>;

// ─── Plans Registry Types ─────────────────────────────────────────────────────

export const PlansRegistryEntrySchema = z.object({
	dir: z.string(), // Relative path: "plans/260412-feature-x"
	title: z.string(),
	status: PlanBoardStatusSchema,
	priority: z.enum(["P1", "P2", "P3"]).optional(),
	branch: z.string().optional(),
	tags: z.array(z.string()).default([]),
	blockedBy: z.array(z.string()).default([]),
	blocks: z.array(z.string()).default([]),
	created: z.string(), // ISO timestamp
	createdBy: z.string(), // "ck:plan" | "ck-cli" | "dashboard"
	source: PlanSourceSchema,
	lastModified: z.string(), // ISO timestamp
	phases: z.array(z.string()), // ["phase-01", "phase-02"]
	progressPct: z.number().int().min(0).max(100),
});
export type PlansRegistryEntry = z.infer<typeof PlansRegistryEntrySchema>;

export const PlansRegistryStatsSchema = z.object({
	totalPlans: z.number().int().min(0),
	completedPlans: z.number().int().min(0),
	avgPhasesPerPlan: z.number().min(0),
});
export type PlansRegistryStats = z.infer<typeof PlansRegistryStatsSchema>;

export const PlansRegistrySchema = z.object({
	version: z.literal(1),
	plans: z.array(PlansRegistryEntrySchema),
	stats: PlansRegistryStatsSchema,
	projectRoot: z.string().optional(), // Absolute path of the project this registry belongs to
});
export type PlansRegistry = z.infer<typeof PlansRegistrySchema>;
