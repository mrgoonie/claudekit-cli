/**
 * TypeScript types for .ck.json configuration
 * Generated from ck-config.schema.json
 */

import { z } from "zod";

// Source indicator for config values
export type ConfigSource = "default" | "project" | "global";

// Plan validation mode
export const PlanValidationModeSchema = z.enum(["prompt", "auto", "strict", "none"]);
export type PlanValidationMode = z.infer<typeof PlanValidationModeSchema>;

// Plan validation focus areas
export const PlanFocusAreaSchema = z.enum([
	"assumptions",
	"risks",
	"tradeoffs",
	"architecture",
	"security",
	"performance",
	"testing",
	"dependencies",
]);
export type PlanFocusArea = z.infer<typeof PlanFocusAreaSchema>;

// Plan resolution order
export const PlanResolutionOrderSchema = z.enum(["session", "branch", "directory"]);
export type PlanResolutionOrder = z.infer<typeof PlanResolutionOrderSchema>;

// Project type
export const ProjectTypeSchema = z.enum([
	"auto",
	"library",
	"application",
	"monorepo",
	"cli",
	"api",
	"web",
	"mobile",
]);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

// Package manager
export const PackageManagerSchema = z.enum(["auto", "npm", "yarn", "pnpm", "bun"]);
export type PackageManager = z.infer<typeof PackageManagerSchema>;

// Framework
export const FrameworkSchema = z.enum([
	"auto",
	"react",
	"vue",
	"angular",
	"svelte",
	"nextjs",
	"nuxt",
	"express",
	"nestjs",
	"fastify",
	"none",
]);
export type Framework = z.infer<typeof FrameworkSchema>;

// Gemini model
export const GeminiModelSchema = z.enum([
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
]);
export type GeminiModel = z.infer<typeof GeminiModelSchema>;

// Statusline mode
export const StatuslineModeSchema = z.enum(["full", "compact", "minimal", "none"]);
export type StatuslineMode = z.infer<typeof StatuslineModeSchema>;

// Coding level (-1 to 5)
export const CodingLevelSchema = z.number().int().min(-1).max(5);
export type CodingLevel = z.infer<typeof CodingLevelSchema>;

// Plan resolution config
export const PlanResolutionSchema = z.object({
	order: z.array(PlanResolutionOrderSchema).optional(),
	branchPattern: z.string().optional(),
});
export type PlanResolution = z.infer<typeof PlanResolutionSchema>;

// Plan validation config
export const PlanValidationSchema = z.object({
	mode: PlanValidationModeSchema.optional(),
	minQuestions: z.number().int().min(0).max(20).optional(),
	maxQuestions: z.number().int().min(1).max(20).optional(),
	focusAreas: z.array(PlanFocusAreaSchema).optional(),
});
export type PlanValidation = z.infer<typeof PlanValidationSchema>;

// Plan config
export const CkPlanConfigSchema = z.object({
	namingFormat: z.string().optional(),
	dateFormat: z.string().optional(),
	issuePrefix: z.string().optional(),
	reportsDir: z.string().optional(),
	resolution: PlanResolutionSchema.optional(),
	validation: PlanValidationSchema.optional(),
});
export type CkPlanConfig = z.infer<typeof CkPlanConfigSchema>;

// Docs config
export const CkDocsConfigSchema = z.object({
	maxLoc: z.number().int().min(100).max(5000).optional(),
});
export type CkDocsConfig = z.infer<typeof CkDocsConfigSchema>;

// Paths config
export const CkPathsConfigSchema = z.object({
	docs: z.string().optional(),
	plans: z.string().optional(),
});
export type CkPathsConfig = z.infer<typeof CkPathsConfigSchema>;

// Locale config
export const CkLocaleConfigSchema = z.object({
	thinkingLanguage: z.string().nullable().optional(),
	responseLanguage: z.string().nullable().optional(),
});
export type CkLocaleConfig = z.infer<typeof CkLocaleConfigSchema>;

// Trust config
export const CkTrustConfigSchema = z.object({
	passphrase: z.string().nullable().optional(),
	enabled: z.boolean().optional(),
});
export type CkTrustConfig = z.infer<typeof CkTrustConfigSchema>;

// Project detection config
export const CkProjectConfigSchema = z.object({
	type: ProjectTypeSchema.optional(),
	packageManager: PackageManagerSchema.optional(),
	framework: FrameworkSchema.optional(),
});
export type CkProjectConfig = z.infer<typeof CkProjectConfigSchema>;

// Gemini config
export const CkGeminiConfigSchema = z.object({
	model: GeminiModelSchema.optional(),
});
export type CkGeminiConfig = z.infer<typeof CkGeminiConfigSchema>;

// Skills config (research skill + custom)
export const CkSkillsConfigSchema = z
	.object({
		research: z
			.object({
				useGemini: z.boolean().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();
export type CkSkillsConfig = z.infer<typeof CkSkillsConfigSchema>;

// Assertion
export const CkAssertionSchema = z.object({
	pattern: z.string().optional(),
	rule: z.string().optional(),
	message: z.string().optional(),
});
export type CkAssertion = z.infer<typeof CkAssertionSchema>;

// Hooks config
export const CkHooksConfigSchema = z.object({
	"session-init": z.boolean().optional(),
	"subagent-init": z.boolean().optional(),
	"dev-rules-reminder": z.boolean().optional(),
	"usage-context-awareness": z.boolean().optional(),
	"scout-block": z.boolean().optional(),
	"privacy-block": z.boolean().optional(),
	"post-edit-simplify-reminder": z.boolean().optional(),
});
export type CkHooksConfig = z.infer<typeof CkHooksConfigSchema>;

// Full CkConfig schema
export const CkConfigSchema = z
	.object({
		$schema: z.string().optional(),
		codingLevel: CodingLevelSchema.optional(),
		statusline: StatuslineModeSchema.optional(),
		privacyBlock: z.boolean().optional(),
		docs: CkDocsConfigSchema.optional(),
		plan: CkPlanConfigSchema.optional(),
		paths: CkPathsConfigSchema.optional(),
		locale: CkLocaleConfigSchema.optional(),
		trust: CkTrustConfigSchema.optional(),
		project: CkProjectConfigSchema.optional(),
		gemini: CkGeminiConfigSchema.optional(),
		skills: CkSkillsConfigSchema.optional(),
		assertions: z.array(CkAssertionSchema).optional(),
		hooks: CkHooksConfigSchema.optional(),
	})
	.passthrough();

export type CkConfig = z.infer<typeof CkConfigSchema>;

// Config with source tracking
export interface CkConfigWithSources {
	config: CkConfig;
	sources: Record<string, ConfigSource>;
	globalPath: string;
	projectPath: string | null;
}

// Default values matching schema defaults
export const DEFAULT_CK_CONFIG: CkConfig = {
	codingLevel: -1,
	statusline: "full",
	privacyBlock: true,
	docs: {
		maxLoc: 800,
	},
	plan: {
		namingFormat: "{date}-{issue}-{slug}",
		dateFormat: "YYMMDD-HHmm",
		issuePrefix: "GH-",
		reportsDir: "reports",
		resolution: {
			order: ["session", "branch"],
			branchPattern: "(?:feat|fix|chore|refactor|docs)/(?:[^/]+/)?(.+)",
		},
		validation: {
			mode: "prompt",
			minQuestions: 3,
			maxQuestions: 8,
			focusAreas: ["assumptions", "risks", "tradeoffs", "architecture"],
		},
	},
	paths: {
		docs: "docs",
		plans: "plans",
	},
	locale: {
		thinkingLanguage: null,
		responseLanguage: null,
	},
	trust: {
		passphrase: null,
		enabled: false,
	},
	project: {
		type: "auto",
		packageManager: "auto",
		framework: "auto",
	},
	gemini: {
		model: "gemini-3-flash-preview",
	},
	skills: {
		research: {
			useGemini: true,
		},
	},
	assertions: [],
	hooks: {
		"session-init": true,
		"subagent-init": true,
		"dev-rules-reminder": true,
		"usage-context-awareness": true,
		"scout-block": true,
		"privacy-block": true,
		"post-edit-simplify-reminder": true,
	},
};

// Hook names for iteration
export const CK_HOOK_NAMES = [
	"session-init",
	"subagent-init",
	"dev-rules-reminder",
	"usage-context-awareness",
	"scout-block",
	"privacy-block",
	"post-edit-simplify-reminder",
] as const;

export type CkHookName = (typeof CK_HOOK_NAMES)[number];
