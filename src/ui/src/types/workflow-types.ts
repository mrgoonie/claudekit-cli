export type WorkflowCategory =
  | 'getting-started'
  | 'design-frontend'
  | 'debugging-fixes'
  | 'planning-review'
  | 'research-docs'
  | 'shipping'
  | 'backend-infra'
  | 'media-creative'
  | 'advanced';

export type WorkflowComplexity = 'beginner' | 'intermediate' | 'advanced';

export interface WorkflowStep {
  id: string;
  skill: string;           // "plan", "cook", "test"
  command: string;         // "/ck:plan"
  description?: string;    // What this step does
  transitionLabel?: string; // Label for edge to next step
}

export interface WorkflowFlag {
  flag: string;            // "--interactive"
  description: string;     // "Uses native Claude Tasks API"
}

export interface Workflow {
  id: string;
  name: string;
  nameKey: string;         // i18n key for name
  category: WorkflowCategory;
  complexity: WorkflowComplexity;
  timeEstimate: string;    // "~15-30 min"
  description: string;
  descriptionKey: string;  // i18n key for description
  steps: WorkflowStep[];
  flags?: WorkflowFlag[];
  proTips?: string[];
  isBuiltIn: boolean;      // true = hardcoded, false = user-created
}

export interface WorkflowCategoryMeta {
  id: WorkflowCategory;
  labelKey: string;        // i18n key
}
