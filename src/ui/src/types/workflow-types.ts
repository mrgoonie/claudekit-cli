import type { TranslationKey } from "../i18n";

export type WorkflowCategory =
	| "getting-started"
	| "design-frontend"
	| "debugging-fixes"
	| "planning-review"
	| "research-docs"
	| "shipping"
	| "backend-infra"
	| "media-creative"
	| "advanced";

export type WorkflowComplexity = "beginner" | "intermediate" | "advanced";

export interface WorkflowStep {
	id: string;
	skill: string; // "plan", "cook", "test"
	command?: string; // Resolved from skills API or fallback to "/ck:{skill}"
	description?: string; // What this step does
	transitionLabel?: string; // Label for edge to next step
}

/** WorkflowStep with command guaranteed to be resolved */
export interface ResolvedWorkflowStep extends WorkflowStep {
	command: string;
}

/** Workflow with all steps resolved */
export interface ResolvedWorkflow extends Omit<Workflow, "steps"> {
	steps: ResolvedWorkflowStep[];
}

export interface Workflow {
	id: string;
	name: string;
	nameKey: TranslationKey;
	category: WorkflowCategory;
	complexity: WorkflowComplexity;
	timeEstimate: string; // "~15-30 min"
	description: string;
	descriptionKey: TranslationKey;
	steps: WorkflowStep[];
	isBuiltIn: boolean; // true = hardcoded, false = user-created
}

export interface WorkflowCategoryMeta {
	id: WorkflowCategory;
	labelKey: TranslationKey;
}
