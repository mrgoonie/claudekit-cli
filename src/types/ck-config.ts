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

// Gemini model — known models as suggestions, but any string accepted for forward-compatibility
export const GEMINI_MODEL_VALUES = [
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
] as const;

const LEGACY_GEMINI_MODEL_ALIASES: Record<string, (typeof GEMINI_MODEL_VALUES)[number]> = {
	"gemini-3.0-flash": "gemini-3-flash-preview",
	"gemini-3.0-pro": "gemini-3-pro-preview",
	"gemini-3-flash": "gemini-3-flash-preview",
	"gemini-3-pro": "gemini-3-pro-preview",
};

export const GeminiModelSchema = z.string().default("gemini-3-flash-preview");
export type GeminiModel = z.infer<typeof GeminiModelSchema>;

// Statusline mode
export const StatuslineModeSchema = z.enum(["full", "compact", "minimal", "none"]);
export type StatuslineMode = z.infer<typeof StatuslineModeSchema>;

// Section IDs for the statusline
export const StatuslineSectionIdSchema = z.enum([
	"model", // Model name + provider
	"context", // Context window progress bar
	"quota", // Usage quota chips (5h, wk)
	"directory", // Current working directory
	"git", // Git branch + status
	"cost", // Session cost
	"changes", // Lines added/removed
	"agents", // Active/recent agents
	"todos", // Current todos/tasks
]);
export type StatuslineSectionId = z.infer<typeof StatuslineSectionIdSchema>;

// Per-section visual customization (icon, label, color overrides)
export const StatuslineSectionConfigSchema = z.object({
	icon: z.string().max(20).optional(), // Custom emoji/icon override
	label: z.string().max(50).optional(), // Custom label override
	// Restricted to ANSI named colors (e.g. red, cyan, green). Hex codes (#ff0000) are not supported.
	color: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.optional(), // Custom ANSI color name (alphabetic only)
	maxWidth: z.number().int().min(10).max(500).optional(), // Max chars for this section
});
export type StatuslineSectionConfig = z.infer<typeof StatuslineSectionConfigSchema>;

// Color theme for statusline
export const StatuslineThemeSchema = z.object({
	name: z.string().max(50).optional(),
	contextLow: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.default("green"), // <50%
	contextMid: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.default("yellow"), // 50-75%
	contextHigh: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.default("red"), // >75%
	accent: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.default("cyan"),
	// ANSI style modifiers like "dim" are valid here, not just color names.
	muted: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.default("dim"),
	// ANSI style modifiers like "dim" are valid here, not just color names.
	separator: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.default("dim"),
	quotaLow: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.optional(),
	quotaHigh: z
		.string()
		.max(30)
		.regex(/^[a-zA-Z]+$/)
		.optional(),
});
export type StatuslineTheme = z.infer<typeof StatuslineThemeSchema>;

// Full statusline layout config — lines-based model
// Each line is an array of section IDs defining which sections appear on that terminal row.
// Sections not listed in any line are hidden. Order within a line = left-to-right order.
export const StatuslineLayoutSchema = z.object({
	baseMode: StatuslineModeSchema.default("full"), // Starting template
	lines: z.array(z.array(StatuslineSectionIdSchema)).max(10).optional(), // Layout lines — each inner array is one terminal row of section IDs
	sectionConfig: z.record(z.string(), StatuslineSectionConfigSchema).optional(), // Per-section overrides keyed by section ID
	theme: StatuslineThemeSchema.optional(),
	responsiveBreakpoint: z.number().min(0.5).max(1.0).default(0.85), // % of terminal width
	maxAgentRows: z.number().int().min(1).max(10).default(4),
	todoTruncation: z.number().int().min(20).max(100).default(50),
});
export type StatuslineLayout = z.infer<typeof StatuslineLayoutSchema>;

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
	globalPlans: z.string().optional(),
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

// Update pipeline config — 3 independent steps: CLI update → kit init → provider migrate
export const UpdatePipelineSchema = z.object({
	autoInitAfterUpdate: z.boolean().default(false),
	autoMigrateAfterUpdate: z.boolean().default(false),
	migrateProviders: z.union([z.literal("auto"), z.array(z.string())]).default("auto"),
});
export type UpdatePipelineConfig = z.infer<typeof UpdatePipelineSchema>;

function normalizeMigrateProviderToken(token: string): string {
	const trimmed = token.trim();
	const unwrapped =
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
			? trimmed.slice(1, -1)
			: trimmed;

	return unwrapped.trim().toLowerCase();
}

function normalizeGeminiModelValue(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}

	const normalized = value.trim().toLowerCase();
	return LEGACY_GEMINI_MODEL_ALIASES[normalized] ?? normalized;
}

function parseMigrateProvidersString(value: string): string | string[] {
	const trimmed = value.trim();
	if (!trimmed) return [];

	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === "string" || Array.isArray(parsed)) {
			return parsed;
		}
	} catch {
		// Fall back to plain-text normalization below.
	}

	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed
			.slice(1, -1)
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
	}

	return trimmed;
}

function normalizeMigrateProviderList(value: string[]): string | string[] {
	const parts = value
		.map(normalizeMigrateProviderToken)
		.filter(Boolean)
		.filter((part, index, list) => list.indexOf(part) === index);

	if (parts.length === 0 || (parts.length === 1 && parts[0] === "auto")) {
		return "auto";
	}

	return parts.filter((part) => part !== "auto");
}

function normalizeMigrateProvidersValue(value: unknown): unknown {
	if (typeof value === "string") {
		const parsed = parseMigrateProvidersString(value);
		const parts = Array.isArray(parsed) ? parsed : String(parsed).split(",");
		return normalizeMigrateProviderList(parts);
	}

	if (Array.isArray(value)) {
		return normalizeMigrateProviderList(
			value.filter((item): item is string => typeof item === "string"),
		);
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return normalizeMigrateProvidersValue(String(value));
	}

	return value;
}

export function normalizeMigrateProvidersInput(value: string): string | string[] {
	const normalized = normalizeMigrateProvidersValue(value);

	if (normalized === "auto" || Array.isArray(normalized)) {
		return normalized;
	}

	return normalizeMigrateProviderList(String(normalized).split(","));
}

export function normalizeCkConfigInput(value: unknown): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return value;
	}

	const normalized = structuredClone(value as Record<string, unknown>);
	const gemini = normalized.gemini;
	const updatePipeline = normalized.updatePipeline;

	if (gemini && typeof gemini === "object" && !Array.isArray(gemini)) {
		const geminiConfig = gemini as Record<string, unknown>;
		if ("model" in geminiConfig) {
			geminiConfig.model = normalizeGeminiModelValue(geminiConfig.model);
		}
	}

	if (updatePipeline && typeof updatePipeline === "object" && !Array.isArray(updatePipeline)) {
		const pipeline = updatePipeline as Record<string, unknown>;
		if ("migrateProviders" in pipeline) {
			pipeline.migrateProviders = normalizeMigrateProvidersValue(pipeline.migrateProviders);
		}
	}

	return normalized;
}

// Model taxonomy: per-provider model mapping overrides for portable migration
export const ResolvedModelConfigSchema = z.object({
	model: z.string(),
	effort: z.string().optional(),
});
export type ResolvedModelConfig = z.infer<typeof ResolvedModelConfigSchema>;

export const ModelTierMapSchema = z.object({
	heavy: ResolvedModelConfigSchema.optional(),
	balanced: ResolvedModelConfigSchema.optional(),
	light: ResolvedModelConfigSchema.optional(),
});
export type ModelTierMap = z.infer<typeof ModelTierMapSchema>;

export const CkModelTaxonomySchema = z.record(z.string(), ModelTierMapSchema);
export type CkModelTaxonomy = z.infer<typeof CkModelTaxonomySchema>;

// Assertion
export const CkAssertionSchema = z.object({
	pattern: z.string().optional(),
	rule: z.string().optional(),
	message: z.string().optional(),
});
export type CkAssertion = z.infer<typeof CkAssertionSchema>;

// SYNC POINT: When adding/removing hooks in claudekit-engineer settings.json,
// update ALL of: CkHooksConfigSchema, DEFAULT_CK_CONFIG.hooks, CK_HOOK_NAMES,
// src/schemas/ck-config.schema.json, GlobalConfigPage.tsx sections,
// src/ui/src/services/configFieldDocs.ts, and src/ui/src/i18n/translations.ts (EN + VI)
//
// NOTE: .passthrough() is intentional — user .ck.json files may contain
// hook keys installed by older or newer kit versions (e.g. post-edit-simplify-reminder).
// Without passthrough, Zod silently strips unknown keys causing the config panel
// to appear to lose custom hook settings when round-tripped through the editor.
export const CkHooksConfigSchema = z
	.object({
		"session-init": z.boolean().optional(),
		"subagent-init": z.boolean().optional(),
		"descriptive-name": z.boolean().optional(),
		"dev-rules-reminder": z.boolean().optional(),
		"usage-context-awareness": z.boolean().optional(),
		"context-tracking": z.boolean().optional(),
		"scout-block": z.boolean().optional(),
		"privacy-block": z.boolean().optional(),
		"simplify-gate": z.boolean().optional(),
	})
	.passthrough();
export type CkHooksConfig = z.infer<typeof CkHooksConfigSchema>;

// SYNC POINT: Simplify config block (mirrors claudekit-engineer simplify-gate hook).
// Root .strict() to lock keys; nested blocks .passthrough() for forward-compat.
// threshold and gate use .default({}) so Zod applies field-level defaults when the
// sub-object is absent or empty — e.g. `simplify: {}` still yields full defaults.
export const CkSimplifyConfigSchema = z
	.object({
		threshold: z
			.object({
				locDelta: z.number().int().nonnegative().default(400),
				fileCount: z.number().int().nonnegative().default(8),
				singleFileLoc: z.number().int().nonnegative().default(200),
			})
			.passthrough()
			.default({}),
		gate: z
			.object({
				enabled: z.boolean().default(false),
				hardVerbs: z.array(z.string()).default(["ship", "merge", "pr", "deploy", "publish"]),
				softVerbs: z.array(z.string()).default(["commit", "finalize", "release"]),
			})
			.passthrough()
			.default({}),
	})
	.strict();
export type CkSimplifyConfig = z.infer<typeof CkSimplifyConfigSchema>;

// Full CkConfig schema
export const CkConfigSchema = z
	.object({
		$schema: z.string().optional(),
		codingLevel: CodingLevelSchema.optional(),
		statusline: StatuslineModeSchema.optional(),
		statuslineColors: z.boolean().optional(),
		statuslineQuota: z.boolean().optional(),
		/** When both statusline and statuslineLayout.baseMode are set, statuslineLayout takes precedence */
		statuslineLayout: StatuslineLayoutSchema.optional(),
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
		simplify: CkSimplifyConfigSchema.optional(),
		updatePipeline: UpdatePipelineSchema.optional(),
		modelTaxonomy: CkModelTaxonomySchema.optional(),
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
	statuslineColors: true,
	statuslineQuota: true,
	statuslineLayout: undefined, // When undefined, uses hardcoded defaults (backward compat)
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
		globalPlans: "plans",
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
		"descriptive-name": true,
		"dev-rules-reminder": true,
		"usage-context-awareness": true,
		"context-tracking": true,
		"scout-block": true,
		"privacy-block": true,
		"simplify-gate": true,
	},
	simplify: {
		threshold: { locDelta: 400, fileCount: 8, singleFileLoc: 200 },
		gate: {
			enabled: false,
			hardVerbs: ["ship", "merge", "pr", "deploy", "publish"],
			softVerbs: ["commit", "finalize", "release"],
		},
	},
	updatePipeline: {
		autoInitAfterUpdate: false,
		autoMigrateAfterUpdate: false,
		migrateProviders: "auto",
	},
};

// Hook names for iteration
export const CK_HOOK_NAMES = [
	"session-init",
	"subagent-init",
	"descriptive-name",
	"dev-rules-reminder",
	"usage-context-awareness",
	"context-tracking",
	"scout-block",
	"privacy-block",
	"simplify-gate",
] as const;

export type CkHookName = (typeof CK_HOOK_NAMES)[number];
