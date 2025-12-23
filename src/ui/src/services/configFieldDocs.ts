export interface FieldDoc {
	description: string;
	type: string;
	default?: string;
	example?: string;
	link?: string;
}

export const CONFIG_FIELD_DOCS: Record<string, FieldDoc> = {
	"paths.docs": {
		description: "Directory name for documentation files",
		type: "string",
		default: "docs",
		example: "ai-docs",
	},
	"paths.plans": {
		description: "Directory name for implementation plans",
		type: "string",
		default: "plans",
		example: "roadmap",
	},
	"defaults.kit": {
		description: "Default ClaudeKit type for new projects",
		type: "string",
		default: "engineer",
		example: "engineer | marketing",
	},
	"plan.namingFormat": {
		description: "Format for plan directory names",
		type: "string",
		default: "{date}-{issue}-{slug}",
		example: "{date}-{slug}",
	},
	"plan.dateFormat": {
		description: "Date format for plan names",
		type: "string",
		default: "YYMMDD-HHmm",
		example: "YYYY-MM-DD",
	},
	github: {
		description: "GitHub authentication token",
		type: "string",
		example: "ghp_xxxx",
	},
	"folders.docs": {
		description: "Custom docs folder name",
		type: "string",
		default: "docs",
	},
	"folders.plans": {
		description: "Custom plans folder name",
		type: "string",
		default: "plans",
	},
};
