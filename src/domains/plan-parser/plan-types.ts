/**
 * Plan Parser Domain Types
 * Zod schemas for plan phases, validation, and summary structures
 */
import { z } from "zod";

export const PhaseStatusSchema = z.enum(["completed", "in-progress", "pending"]);
export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

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

export const CreatePlanOptionsSchema = z.object({
	title: z.string().min(1),
	phases: z.array(PhaseInputSchema).min(1),
	dir: z.string().min(1),
	priority: z.enum(["P1", "P2", "P3"]).optional().default("P2"),
	issue: z.number().optional(),
	description: z.string().optional(),
});
export type CreatePlanOptions = z.infer<typeof CreatePlanOptionsSchema>;

export const PlanSummarySchema = z.object({
	planDir: z.string(),
	planFile: z.string(),
	title: z.string().optional(),
	description: z.string().optional(),
	status: z.string().optional(),
	totalPhases: z.number().int(),
	completed: z.number().int(),
	inProgress: z.number().int(),
	pending: z.number().int(),
	phases: z.array(PlanPhaseSchema),
});
export type PlanSummary = z.infer<typeof PlanSummarySchema>;
