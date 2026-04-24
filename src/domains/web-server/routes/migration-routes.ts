/**
 * Migration API routes
 */

import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { discoverAgents, getAgentSourcePath } from "@/commands/agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "@/commands/commands/commands-discovery.js";
import { installSkillDirectories } from "@/commands/migrate/skill-directory-installer.js";
import { cleanupStaleCodexConfigEntries } from "@/commands/portable/codex-toml-installer.js";
import {
	discoverConfig,
	discoverHooks,
	discoverRules,
	getConfigSourcePath,
	getGlobalConfigSourcePath,
	getHooksSourcePath,
	getRulesSourcePath,
	resolveSourceOrigin,
} from "@/commands/portable/config-discovery.js";
import { migrateHooksSettings } from "@/commands/portable/hooks-settings-merger.js";
import { installPortableItems } from "@/commands/portable/portable-installer.js";
import { loadPortableManifest } from "@/commands/portable/portable-manifest.js";
import {
	readPortableRegistry,
	removeInstallationsByFilter,
	removePortableInstallation,
	updateAppliedManifestVersion,
} from "@/commands/portable/portable-registry.js";
import {
	detectInstalledProviders,
	detectProviderPathCollisions,
	getProvidersSupporting,
	providers,
} from "@/commands/portable/provider-registry.js";
import { backfillRegistryChecksums } from "@/commands/portable/reconcile-registry-backfill.js";
import {
	type ConversionFallbackWarning,
	buildSourceItemState,
	buildTargetStates,
	buildTypeDirectoryStates,
} from "@/commands/portable/reconcile-state-builders.js";
import type {
	ConflictResolution,
	ReconcileInput,
	ReconcileProviderInput,
	SourceItemState,
} from "@/commands/portable/reconcile-types.js";
import { isUnknownChecksum } from "@/commands/portable/reconcile-types.js";
import { reconcile } from "@/commands/portable/reconciler.js";
import type {
	PortableInstallResult,
	PortableType,
	ProviderType as ProviderTypeValue,
} from "@/commands/portable/types.js";
import { ProviderType } from "@/commands/portable/types.js";
import { discoverSkills, getSkillSourcePath } from "@/commands/skills/skills-discovery.js";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
	annotateResultsWithCollisions,
	emptyDiscoveryCounts,
	toDiscoveryCounts,
} from "./migration-result-utils.js";

type MigrationPortableType = "agents" | "commands" | "skills" | "config" | "rules" | "hooks";

interface MigrationIncludeOptions {
	agents: boolean;
	commands: boolean;
	skills: boolean;
	config: boolean;
	rules: boolean;
	hooks: boolean;
}

const MIGRATION_TYPES: MigrationPortableType[] = [
	"agents",
	"commands",
	"skills",
	"config",
	"rules",
	"hooks",
];
const MAX_PROVIDER_COUNT = 20;
const MAX_PLAN_ACTIONS = 5000;

const ALLOWED_CONFIG_SOURCE_KEYS = ["default", "global", "project", "local"] as const;
type ConfigSourceKey = (typeof ALLOWED_CONFIG_SOURCE_KEYS)[number];

const CONFLICT_RESOLUTION_SCHEMA = z.discriminatedUnion("type", [
	z.object({ type: z.literal("overwrite") }),
	z.object({ type: z.literal("keep") }),
	z.object({ type: z.literal("smart-merge") }),
	z.object({ type: z.literal("resolved"), content: z.string().min(1) }),
]);

const RECONCILE_ACTION_SCHEMA = z
	.object({
		action: z.enum(["install", "update", "skip", "conflict", "delete"]),
		item: z.string().min(1),
		type: z.enum(["agent", "command", "skill", "config", "rules", "hooks"]),
		provider: ProviderType,
		global: z.boolean(),
		targetPath: z.string(),
		reason: z.string().min(1),
		sourceChecksum: z.string().optional(),
		registeredSourceChecksum: z.string().optional(),
		currentTargetChecksum: z.string().optional(),
		registeredTargetChecksum: z.string().optional(),
		previousItem: z.string().optional(),
		previousPath: z.string().optional(),
		cleanupPaths: z.array(z.string()).optional(),
		ownedSections: z.array(z.string()).optional(),
		affectedSections: z.array(z.string()).optional(),
		diff: z.string().optional(),
		resolution: CONFLICT_RESOLUTION_SCHEMA.optional(),
		// P2 additions — additive, optional for backward-compat
		reasonCode: z.string().optional(),
		reasonCopy: z.string().optional(),
		isDirectoryItem: z.boolean().optional(),
	})
	.passthrough();

const RECONCILE_BANNER_SCHEMA = z.object({
	kind: z.enum(["empty-dir", "empty-dir-respected"]),
	provider: z.string(),
	type: z.string(),
	global: z.boolean(),
	path: z.string(),
	itemCount: z.number().int().nonnegative(),
	message: z.string(),
});

const RECONCILE_PLAN_SCHEMA = z
	.object({
		actions: z.array(RECONCILE_ACTION_SCHEMA).max(MAX_PLAN_ACTIONS),
		summary: z.object({
			install: z.number().int().nonnegative(),
			update: z.number().int().nonnegative(),
			skip: z.number().int().nonnegative(),
			conflict: z.number().int().nonnegative(),
			delete: z.number().int().nonnegative(),
		}),
		hasConflicts: z.boolean(),
		// P2 addition — additive, defaults to [] for backward-compat with pre-P2 stored plans
		banners: z.array(RECONCILE_BANNER_SCHEMA).optional().default([]),
	})
	.passthrough();

const PLAN_EXECUTE_PAYLOAD_SCHEMA = z
	.object({
		plan: RECONCILE_PLAN_SCHEMA,
		resolutions: z.record(CONFLICT_RESOLUTION_SCHEMA).optional().default({}),
		// Behavioral: in "install" mode the plan is authoritative — the skills
		// fallback treats an empty allowedSkillNames as "none" instead of
		// "install everything". See #740.
		mode: z.enum(["reconcile", "install"]).optional(),
	})
	.passthrough();

interface DiscoveryResult {
	agents: Awaited<ReturnType<typeof discoverAgents>>;
	commands: Awaited<ReturnType<typeof discoverCommands>>;
	skills: Awaited<ReturnType<typeof discoverSkills>>;
	configItem: Awaited<ReturnType<typeof discoverConfig>>;
	ruleItems: Awaited<ReturnType<typeof discoverRules>>;
	hookItems: import("@/commands/portable/types.js").PortableItem[];
	sourcePaths: {
		agents: string | null;
		commands: string | null;
		skills: string | null;
		hooks: string | null;
		config: string | null;
		rules: string | null;
	};
}

interface ValidationResult<T> {
	ok: boolean;
	value?: T;
	error?: string;
}

function isDisallowedControlCode(codePoint: number): boolean {
	return (
		(codePoint >= 0x00 && codePoint <= 0x08) ||
		(codePoint >= 0x0b && codePoint <= 0x1f) ||
		(codePoint >= 0x7f && codePoint <= 0x9f)
	);
}

function stripControlChars(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint === undefined) continue;
		if (!isDisallowedControlCode(codePoint)) {
			output += char;
		}
	}
	return output;
}

function sanitizeUntrusted(input: unknown, maxLength = 180): string {
	const raw =
		typeof input === "string"
			? input
			: input instanceof Error
				? input.message
				: String(input ?? "");
	const sanitized = stripControlChars(raw).replace(/\s+/g, " ").trim();

	if (!sanitized) {
		return "unknown";
	}

	if (sanitized.length <= maxLength) {
		return sanitized;
	}

	return `${sanitized.slice(0, maxLength)}...`;
}

function warnReadFailure(itemType: string, itemName: string, error: unknown): void {
	console.warn(
		`[migrate] Failed to read ${sanitizeUntrusted(itemType)} "${sanitizeUntrusted(itemName, 80)}": ${sanitizeUntrusted(error, 260)}`,
	);
}

function parseBooleanLike(input: unknown): ValidationResult<boolean | undefined> {
	if (input === undefined || input === null) {
		return { ok: true, value: undefined };
	}
	if (typeof input === "boolean") {
		return { ok: true, value: input };
	}
	if (typeof input === "string") {
		const normalized = input.trim().toLowerCase();
		if (normalized === "") {
			return { ok: true, value: undefined };
		}
		if (normalized === "true") {
			return { ok: true, value: true };
		}
		if (normalized === "false") {
			return { ok: true, value: false };
		}
		if (normalized === "1") {
			return { ok: true, value: true };
		}
		if (normalized === "0") {
			return { ok: true, value: false };
		}
	}

	return { ok: false, error: "must be a boolean" };
}

function parseIncludeOptionsStrict(
	rawInput: unknown,
	labelPrefix: string,
): ValidationResult<MigrationIncludeOptions> {
	if (rawInput !== undefined && rawInput !== null && typeof rawInput !== "object") {
		return { ok: false, error: `${labelPrefix}include must be an object` };
	}

	const raw =
		rawInput && typeof rawInput === "object"
			? (rawInput as Partial<Record<keyof MigrationIncludeOptions, unknown>>)
			: {};

	const partial: Partial<Record<keyof MigrationIncludeOptions, boolean>> = {};
	const explicitTypes = new Set<keyof MigrationIncludeOptions>();
	for (const type of MIGRATION_TYPES) {
		const parsed = parseBooleanLike(raw[type]);
		if (!parsed.ok) {
			return { ok: false, error: `${labelPrefix}${type} ${parsed.error}` };
		}
		if (parsed.value !== undefined) {
			partial[type] = parsed.value;
			explicitTypes.add(type);
		}
	}

	const include = normalizeIncludeOptions(partial);
	if (explicitTypes.size > 0 && !explicitTypes.has("hooks")) {
		// Backward compatibility: legacy clients may not send `hooks`.
		// If they explicitly set other include flags, treat missing hooks as disabled.
		include.hooks = false;
	}
	if (countEnabledTypes(include) === 0) {
		return { ok: false, error: "At least one migration type must be enabled" };
	}

	return { ok: true, value: include };
}

function parseProvidersFromTokens(
	rawTokens: unknown[],
	requiredMessage: string,
	maxCountMessage: string,
): ValidationResult<ProviderTypeValue[]> {
	const normalizedTokens: string[] = [];
	for (const rawToken of rawTokens) {
		if (typeof rawToken !== "string") {
			return { ok: false, error: "providers values must be strings" };
		}
		const token = rawToken.trim();
		if (token) {
			normalizedTokens.push(token);
		}
	}

	if (normalizedTokens.length === 0) {
		return { ok: false, error: requiredMessage };
	}

	const selectedProviders: ProviderTypeValue[] = [];
	const seen = new Set<ProviderTypeValue>();
	for (const rawProvider of normalizedTokens) {
		const parsed = ProviderType.safeParse(rawProvider);
		if (!parsed.success) {
			return { ok: false, error: `Unknown provider: ${sanitizeUntrusted(rawProvider, 64)}` };
		}
		if (!seen.has(parsed.data)) {
			seen.add(parsed.data);
			selectedProviders.push(parsed.data);
		}
	}

	if (selectedProviders.length > MAX_PROVIDER_COUNT) {
		return { ok: false, error: maxCountMessage };
	}

	return { ok: true, value: selectedProviders };
}

function parseProvidersFromQuery(value: unknown): ValidationResult<ProviderTypeValue[]> {
	if (value === undefined || value === null) {
		return { ok: false, error: "providers parameter is required" };
	}

	const rawTokens: unknown[] = [];
	if (typeof value === "string") {
		rawTokens.push(...value.split(","));
	} else if (Array.isArray(value)) {
		for (const entry of value) {
			if (typeof entry !== "string") {
				return { ok: false, error: "providers parameter must contain strings" };
			}
			rawTokens.push(...entry.split(","));
		}
	} else {
		return { ok: false, error: "providers parameter must be a comma-separated string" };
	}

	return parseProvidersFromTokens(
		rawTokens,
		"providers parameter is required",
		`providers parameter exceeds maximum of ${MAX_PROVIDER_COUNT} entries`,
	);
}

function parseProvidersFromBody(value: unknown): ValidationResult<ProviderTypeValue[]> {
	if (!Array.isArray(value)) {
		return { ok: false, error: "providers is required and must be a non-empty array" };
	}

	return parseProvidersFromTokens(
		value,
		"providers is required and must be a non-empty array",
		`providers array exceeds maximum of ${MAX_PROVIDER_COUNT} entries`,
	);
}

function parseConfigSource(input: unknown): ValidationResult<string | undefined> {
	if (input === undefined || input === null) {
		return { ok: true, value: undefined };
	}
	if (typeof input !== "string") {
		return { ok: false, error: "source must be a string" };
	}

	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: true, value: undefined };
	}

	const projectSourcePath = resolve(process.cwd(), "CLAUDE.md");
	const globalSourcePath = resolve(getGlobalConfigSourcePath());
	const sourceMap: Record<ConfigSourceKey, string | undefined> = {
		default: undefined,
		global: globalSourcePath,
		project: projectSourcePath,
		local: projectSourcePath,
	};

	const normalizedKey = trimmed.toLowerCase() as ConfigSourceKey;
	if (normalizedKey in sourceMap) {
		return { ok: true, value: sourceMap[normalizedKey] };
	}

	const resolved = resolve(trimmed);
	if (resolved === globalSourcePath || resolved === projectSourcePath) {
		return { ok: true, value: resolved };
	}

	return {
		ok: false,
		error: `Invalid source. Allowed values: ${ALLOWED_CONFIG_SOURCE_KEYS.join(", ")}`,
	};
}

function getConflictKey(action: {
	provider: string;
	type: string;
	item: string;
	global: boolean;
}): string {
	return JSON.stringify([action.provider, action.type, action.item, action.global]);
}

function getLegacyConflictKey(action: {
	provider: string;
	type: string;
	item: string;
	global: boolean;
}): string {
	return `${action.provider}:${action.type}:${action.item}:${action.global}`;
}

function validatePlanParity(
	plan: z.infer<typeof RECONCILE_PLAN_SCHEMA>,
): ValidationResult<z.infer<typeof RECONCILE_PLAN_SCHEMA>> {
	const computed = {
		install: 0,
		update: 0,
		skip: 0,
		conflict: 0,
		delete: 0,
	};

	for (const action of plan.actions) {
		computed[action.action] += 1;
	}

	const summaryMatches =
		computed.install === plan.summary.install &&
		computed.update === plan.summary.update &&
		computed.skip === plan.summary.skip &&
		computed.conflict === plan.summary.conflict &&
		computed.delete === plan.summary.delete;

	if (!summaryMatches) {
		return { ok: false, error: "Plan summary does not match action counts" };
	}

	if (plan.hasConflicts !== computed.conflict > 0) {
		return { ok: false, error: "Plan hasConflicts does not match conflict actions" };
	}

	return { ok: true, value: plan };
}

function normalizeIncludeOptions(input: unknown): MigrationIncludeOptions {
	const defaults: MigrationIncludeOptions = {
		agents: true,
		commands: true,
		skills: true,
		config: true,
		rules: true,
		hooks: true,
	};

	if (!input || typeof input !== "object") {
		return defaults;
	}

	const parsed = input as Partial<Record<keyof MigrationIncludeOptions, unknown>>;

	return {
		agents: typeof parsed.agents === "boolean" ? parsed.agents : defaults.agents,
		commands: typeof parsed.commands === "boolean" ? parsed.commands : defaults.commands,
		skills: typeof parsed.skills === "boolean" ? parsed.skills : defaults.skills,
		config: typeof parsed.config === "boolean" ? parsed.config : defaults.config,
		rules: typeof parsed.rules === "boolean" ? parsed.rules : defaults.rules,
		hooks: typeof parsed.hooks === "boolean" ? parsed.hooks : defaults.hooks,
	};
}

/** Determine if a reconcile action should be executed (install/update/resolved conflict) */
function shouldExecuteAction(action: { action: string; resolution?: { type: string } }): boolean {
	if (action.action === "install" || action.action === "update") return true;
	if (action.action === "conflict") {
		const resolution = action.resolution?.type;
		return resolution === "overwrite" || resolution === "smart-merge" || resolution === "resolved";
	}
	return false;
}

/** Execute a delete action from the reconciliation plan */
async function executePlanDeleteAction(
	action: { item: string; type: string; provider: string; global: boolean; targetPath: string },
	options?: { preservePaths?: Set<string> },
): Promise<PortableInstallResult> {
	const preservePaths = options?.preservePaths ?? new Set<string>();
	const shouldPreserveTarget =
		action.targetPath.length > 0 && preservePaths.has(resolve(action.targetPath));

	try {
		if (!shouldPreserveTarget && action.targetPath && existsSync(action.targetPath)) {
			await rm(action.targetPath, { recursive: true, force: true });
		}
		await removePortableInstallation(
			action.item,
			action.type as "agent" | "command" | "skill" | "config" | "rules" | "hooks",
			action.provider as ProviderTypeValue,
			action.global,
		);
		return {
			provider: action.provider as ProviderTypeValue,
			providerDisplayName:
				providers[action.provider as ProviderTypeValue]?.displayName || action.provider,
			success: true,
			path: action.targetPath,
			skipped: shouldPreserveTarget,
			skipReason: shouldPreserveTarget
				? "Registry entry removed; target preserved because newer action wrote same path"
				: undefined,
		};
	} catch (error) {
		return {
			provider: action.provider as ProviderTypeValue,
			providerDisplayName:
				providers[action.provider as ProviderTypeValue]?.displayName || action.provider,
			success: false,
			path: action.targetPath,
			error: error instanceof Error ? error.message : "Delete action failed",
		};
	}
}

function countEnabledTypes(include: MigrationIncludeOptions): number {
	return MIGRATION_TYPES.filter((type) => include[type]).length;
}

function inferIncludeFromActions(actions: Array<{ type: PortableType }>): MigrationIncludeOptions {
	const include: MigrationIncludeOptions = {
		agents: false,
		commands: false,
		skills: false,
		config: false,
		rules: false,
		hooks: false,
	};
	for (const action of actions) {
		if (action.type === "agent") include.agents = true;
		else if (action.type === "command") include.commands = true;
		else if (action.type === "skill") include.skills = true;
		else if (action.type === "config") include.config = true;
		else if (action.type === "rules") include.rules = true;
		else if (action.type === "hooks") include.hooks = true;
	}
	return include;
}

function getPlanMeta(plan: z.infer<typeof RECONCILE_PLAN_SCHEMA>): {
	include?: unknown;
	providers?: unknown;
	source?: unknown;
	items?: unknown;
} | null {
	const rawMeta = (plan as { meta?: unknown }).meta;
	if (!rawMeta || typeof rawMeta !== "object") return null;
	return rawMeta as {
		include?: unknown;
		providers?: unknown;
		source?: unknown;
		items?: unknown;
	};
}

function getIncludeFromPlan(plan: z.infer<typeof RECONCILE_PLAN_SCHEMA>): MigrationIncludeOptions {
	const meta = getPlanMeta(plan);
	const hasMetaInclude = meta?.include !== undefined;
	if (meta?.include && typeof meta.include === "object") {
		const parsed = meta.include as Partial<Record<keyof MigrationIncludeOptions, unknown>>;
		const include: MigrationIncludeOptions = {
			agents: parsed.agents === true,
			commands: parsed.commands === true,
			skills: parsed.skills === true,
			config: parsed.config === true,
			rules: parsed.rules === true,
			hooks: parsed.hooks === true,
		};
		if (countEnabledTypes(include) > 0) {
			return include;
		}
	}

	const inferred = inferIncludeFromActions(plan.actions);
	if (!hasMetaInclude) {
		if (countEnabledTypes(inferred) === 0) {
			return normalizeIncludeOptions(undefined);
		}
		return { ...inferred, skills: true };
	}

	return inferred;
}

function getProvidersFromPlan(plan: z.infer<typeof RECONCILE_PLAN_SCHEMA>): ProviderTypeValue[] {
	const meta = getPlanMeta(plan);
	const metaProviders = parseProvidersFromBody(meta?.providers);
	if (metaProviders.ok && metaProviders.value) {
		return metaProviders.value;
	}

	const providersFromActions: ProviderTypeValue[] = [];
	const seen = new Set<ProviderTypeValue>();
	for (const action of plan.actions) {
		const parsed = ProviderType.safeParse(action.provider);
		if (!parsed.success) continue;
		if (seen.has(parsed.data)) continue;
		seen.add(parsed.data);
		providersFromActions.push(parsed.data);
	}
	return providersFromActions;
}

function getConfigSourceFromPlan(plan: z.infer<typeof RECONCILE_PLAN_SCHEMA>): string | undefined {
	const meta = getPlanMeta(plan);
	if (typeof meta?.source !== "string") {
		return undefined;
	}
	const parsed = parseConfigSource(meta.source);
	return parsed.ok ? parsed.value : undefined;
}

function getPlanItemsByType(
	plan: z.infer<typeof RECONCILE_PLAN_SCHEMA>,
	type: MigrationPortableType,
): string[] {
	const meta = getPlanMeta(plan);
	if (!meta?.items || typeof meta.items !== "object") return [];
	const list = (meta.items as Partial<Record<MigrationPortableType, unknown>>)[type];
	if (!Array.isArray(list)) return [];
	const normalized = list
		.filter((entry): entry is string => typeof entry === "string")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	return Array.from(new Set(normalized));
}

function providerSupportsType(provider: ProviderTypeValue, type: PortableType): boolean {
	if (type === "agent") return getProvidersSupporting("agents").includes(provider);
	if (type === "command") return getProvidersSupporting("commands").includes(provider);
	if (type === "skill") return getProvidersSupporting("skills").includes(provider);
	if (type === "config") return getProvidersSupporting("config").includes(provider);
	if (type === "rules") return getProvidersSupporting("rules").includes(provider);
	if (type === "hooks") return getProvidersSupporting("hooks").includes(provider);
	return false;
}

function createSkippedActionResult(
	action: { provider: string; type: PortableType; item: string; targetPath: string },
	reason: string,
): PortableInstallResult {
	const provider = action.provider as ProviderTypeValue;
	return {
		provider,
		providerDisplayName: providers[provider]?.displayName || action.provider,
		success: true,
		path: action.targetPath,
		skipped: true,
		skipReason: reason,
		portableType: action.type,
		itemName: action.item,
	};
}

function toExecutionCounts(results: PortableInstallResult[]): {
	installed: number;
	skipped: number;
	failed: number;
} {
	let installed = 0;
	let skipped = 0;
	let failed = 0;
	for (const result of results) {
		if (!result.success) {
			failed += 1;
			continue;
		}
		if (result.skipped) {
			skipped += 1;
			continue;
		}
		installed += 1;
	}
	return { installed, skipped, failed };
}

function compareSortValues(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

function sortPortableInstallResults(results: PortableInstallResult[]): PortableInstallResult[] {
	return [...results].sort((left, right) => {
		const byType = compareSortValues(left.portableType || "", right.portableType || "");
		if (byType !== 0) return byType;

		const byItem = compareSortValues(left.itemName || "", right.itemName || "");
		if (byItem !== 0) return byItem;

		const byProvider = compareSortValues(left.provider || "", right.provider || "");
		if (byProvider !== 0) return byProvider;

		const byPath = compareSortValues(left.path || "", right.path || "");
		if (byPath !== 0) return byPath;

		const leftSuccessRank = left.success ? 0 : 1;
		const rightSuccessRank = right.success ? 0 : 1;
		if (leftSuccessRank !== rightSuccessRank) {
			return leftSuccessRank - rightSuccessRank;
		}

		const leftSkippedRank = left.skipped ? 1 : 0;
		const rightSkippedRank = right.skipped ? 1 : 0;
		if (leftSkippedRank !== rightSkippedRank) {
			return leftSkippedRank - rightSkippedRank;
		}

		return compareSortValues(left.error || "", right.error || "");
	});
}

const PLURAL_TO_SINGULAR: Record<MigrationPortableType, PortableType> = {
	agents: "agent",
	commands: "command",
	skills: "skill",
	config: "config",
	rules: "rules",
	hooks: "hooks",
};

/** Tag install results with portable type and item name for UI display (mutates in-place) */
function tagResults(
	results: PortableInstallResult[],
	portableType: MigrationPortableType,
	itemName?: string,
): void {
	const singularType = PLURAL_TO_SINGULAR[portableType];
	for (const result of results) {
		result.portableType = singularType;
		if (itemName) {
			result.itemName = itemName;
		} else {
			// Derive item name from path: last segment without extension
			const pathSegments = result.path.replace(/\\/g, "/").split("/");
			const lastSegment = pathSegments[pathSegments.length - 1] || "";
			result.itemName = lastSegment.replace(/\.[^.]+$/, "") || lastSegment;
		}
	}
}

function isHookRegistrationFailure(status: string): boolean {
	return (
		status === "source-settings-invalid" ||
		status === "unsupported-target" ||
		status === "merge-failed"
	);
}

function createHookRegistrationFeedbackResult(
	provider: ProviderTypeValue,
	mergeResult: Awaited<ReturnType<typeof migrateHooksSettings>>,
): PortableInstallResult | null {
	if (mergeResult.status === "registered" || mergeResult.status === "no-installed-files") {
		return null;
	}

	const message = mergeResult.error || mergeResult.message;
	if (!message) return null;

	const failed = isHookRegistrationFailure(mergeResult.status);
	return {
		provider,
		providerDisplayName: providers[provider]?.displayName || provider,
		success: !failed,
		skipped: !failed,
		path: mergeResult.targetSettingsPath ?? "",
		error: failed ? message : undefined,
		skipReason: failed ? undefined : message,
		portableType: "hooks",
		itemName: "hook registration",
	};
}

function recordHookRegistrationOutcome(
	provider: ProviderTypeValue,
	mergeResult: Awaited<ReturnType<typeof migrateHooksSettings>>,
	warnings: string[],
	feedbackResults: PortableInstallResult[],
): void {
	if (mergeResult.success && mergeResult.hooksRegistered > 0) {
		console.info(
			`[migrate] Registered ${mergeResult.hooksRegistered} hook(s) in ${provider} settings.json`,
		);
		return;
	}

	const message = mergeResult.error || mergeResult.message;
	if (message && !warnings.includes(message)) {
		warnings.push(message);
	}
	if (message) {
		console.warn(`[migrate] ${message}`);
	}

	const feedback = createHookRegistrationFeedbackResult(provider, mergeResult);
	if (feedback) {
		feedbackResults.push(feedback);
	}
}

/** Track whether shell hook skip warning has been shown this session to avoid repeated noise */
let shellHookWarningShown = false;

function warnConversionFallback(warning: ConversionFallbackWarning): void {
	console.warn(
		`[migrate] Falling back to raw checksum for ${sanitizeUntrusted(warning.provider)} ${sanitizeUntrusted(warning.type)} "${sanitizeUntrusted(warning.item, 80)}" because ${sanitizeUntrusted(warning.format)} conversion failed: ${sanitizeUntrusted(warning.error, 260)}`,
	);
}

async function discoverMigrationItems(
	include: MigrationIncludeOptions,
	configSource?: string,
): Promise<DiscoveryResult> {
	const agentsSource = include.agents ? getAgentSourcePath() : null;
	const commandsSource = include.commands ? getCommandSourcePath() : null;
	const skillsSource = include.skills ? getSkillSourcePath() : null;
	const hooksSource = include.hooks ? getHooksSourcePath() : null;
	// Resolve config/rules source paths for origin tracking
	const configSourcePath = include.config ? (configSource ?? getConfigSourcePath()) : null;
	const rulesSourcePath = include.rules ? getRulesSourcePath() : null;

	const [agents, commands, skills, configItem, ruleItems, hookItems] = await Promise.all([
		agentsSource ? discoverAgents(agentsSource) : Promise.resolve([]),
		commandsSource ? discoverCommands(commandsSource) : Promise.resolve([]),
		skillsSource ? discoverSkills(skillsSource) : Promise.resolve([]),
		configSourcePath ? discoverConfig(configSourcePath) : Promise.resolve(null),
		rulesSourcePath ? discoverRules(rulesSourcePath) : Promise.resolve([]),
		hooksSource
			? discoverHooks(hooksSource).then(({ items, skippedShellHooks }) => {
					if (skippedShellHooks.length > 0 && !shellHookWarningShown) {
						shellHookWarningShown = true;
						console.warn(
							`[migrate] Skipping ${skippedShellHooks.length} shell hook(s) not supported for migration (node-runnable only): ${skippedShellHooks.join(", ")}`,
						);
					}
					return items;
				})
			: Promise.resolve([]),
	]);

	return {
		agents,
		commands,
		skills,
		configItem,
		ruleItems,
		hookItems,
		sourcePaths: {
			agents: agentsSource,
			commands: commandsSource,
			skills: skillsSource,
			hooks: hooksSource,
			config: configSourcePath,
			rules: rulesSourcePath,
		},
	};
}

function getCapabilities(provider: ProviderTypeValue): Record<MigrationPortableType, boolean> {
	const config = providers[provider];
	return {
		agents: config.agents !== null,
		commands: config.commands !== null,
		skills: config.skills !== null,
		config: config.config !== null,
		rules: config.rules !== null,
		hooks: config.hooks !== null,
	};
}

export function registerMigrationRoutes(app: Express): void {
	// GET /api/migrate/providers - list providers with capabilities + detection status
	app.get("/api/migrate/providers", async (_req: Request, res: Response) => {
		try {
			const detected = new Set(await detectInstalledProviders());
			const allProviders = (Object.keys(providers) as ProviderTypeValue[]).filter(
				(provider) => provider !== "claude-code",
			);

			const providerList = allProviders.map((provider) => {
				const config = providers[provider];
				const commandsGlobalOnly =
					config.commands !== null &&
					config.commands.projectPath === null &&
					config.commands.globalPath !== null;

				return {
					name: provider,
					displayName: config.displayName,
					detected: detected.has(provider),
					recommended: provider === "codex" || provider === "antigravity" || provider === "droid",
					commandsGlobalOnly,
					capabilities: getCapabilities(provider),
				};
			});

			res.status(200).json({ providers: providerList });
		} catch {
			res.status(500).json({ error: "Failed to list migration providers" });
		}
	});

	// GET /api/migrate/discovery - discover source items available for migration
	app.get("/api/migrate/discovery", async (_req: Request, res: Response) => {
		try {
			const includeAll: MigrationIncludeOptions = {
				agents: true,
				commands: true,
				skills: true,
				config: true,
				rules: true,
				hooks: true,
			};
			const discovered = await discoverMigrationItems(includeAll);

			const cwd = process.cwd();
			const home = homedir();
			res.status(200).json({
				cwd,
				targetPaths: {
					project: join(cwd, ".claude"),
					global: join(home, ".claude"),
				},
				sourcePaths: discovered.sourcePaths,
				sourceOrigins: {
					agents: discovered.sourcePaths.agents
						? resolveSourceOrigin(discovered.sourcePaths.agents)
						: null,
					commands: discovered.sourcePaths.commands
						? resolveSourceOrigin(discovered.sourcePaths.commands)
						: null,
					skills: discovered.sourcePaths.skills
						? resolveSourceOrigin(discovered.sourcePaths.skills)
						: null,
					config: discovered.sourcePaths.config
						? resolveSourceOrigin(discovered.sourcePaths.config)
						: null,
					rules: discovered.sourcePaths.rules
						? resolveSourceOrigin(discovered.sourcePaths.rules)
						: null,
					hooks: discovered.sourcePaths.hooks
						? resolveSourceOrigin(discovered.sourcePaths.hooks)
						: null,
				},
				counts: {
					agents: discovered.agents.length,
					commands: discovered.commands.length,
					skills: discovered.skills.length,
					config: discovered.configItem ? 1 : 0,
					rules: discovered.ruleItems.length,
					hooks: discovered.hookItems.length,
				},
				items: {
					agents: discovered.agents.map((item) => item.name),
					commands: discovered.commands.map((item) => item.displayName || item.name),
					skills: discovered.skills.map((item) => item.name),
					config: discovered.configItem ? [discovered.configItem.name] : [],
					rules: discovered.ruleItems.map((item) => item.name),
					hooks: discovered.hookItems.map((item) => item.name),
				},
			});
		} catch {
			res.status(500).json({ error: "Failed to discover migration items" });
		}
	});

	// GET /api/migrate/reconcile - compute migration plan without executing
	app.get("/api/migrate/reconcile", async (req: Request, res: Response) => {
		try {
			const providersParsed = parseProvidersFromQuery(req.query.providers);
			if (!providersParsed.ok || !providersParsed.value) {
				res.status(400).json({ error: providersParsed.error || "Invalid providers parameter" });
				return;
			}
			const selectedProviders = providersParsed.value;

			const includeParsed = parseIncludeOptionsStrict(
				{
					agents: req.query.agents,
					commands: req.query.commands,
					skills: req.query.skills,
					config: req.query.config,
					rules: req.query.rules,
					hooks: req.query.hooks,
				},
				"",
			);
			if (!includeParsed.ok || !includeParsed.value) {
				res.status(400).json({ error: includeParsed.error || "Invalid include options" });
				return;
			}
			const include = includeParsed.value;

			const globalParsed = parseBooleanLike(req.query.global);
			if (!globalParsed.ok) {
				res.status(400).json({ error: `global ${globalParsed.error}` });
				return;
			}
			const globalParam = globalParsed.value === true;

			const sourceParsed = parseConfigSource(req.query.source);
			if (!sourceParsed.ok) {
				res.status(400).json({ error: sourceParsed.error || "Invalid source value" });
				return;
			}
			const configSource = sourceParsed.value;

			// P2: New optional params with sensible defaults per decisions.md
			const reinstallEmptyDirsParsed = parseBooleanLike(req.query.reinstallEmptyDirs);
			if (!reinstallEmptyDirsParsed.ok) {
				res.status(400).json({ error: `reinstallEmptyDirs ${reinstallEmptyDirsParsed.error}` });
				return;
			}
			// Default: true (decisions Q2 — user deleted whole dir = reinstall intent)
			const reinstallEmptyDirs = reinstallEmptyDirsParsed.value !== false;

			const respectDeletionsParsed = parseBooleanLike(req.query.respectDeletions);
			if (!respectDeletionsParsed.ok) {
				res.status(400).json({ error: `respectDeletions ${respectDeletionsParsed.error}` });
				return;
			}
			// Default: false (decisions Q2 — empty dir means reinstall by default)
			const respectDeletions = respectDeletionsParsed.value === true;

			const modeRaw = req.query.mode;
			let reconcileMode: "reconcile" | "install" = "reconcile";
			if (modeRaw !== undefined) {
				const modeStr = String(modeRaw).trim().toLowerCase();
				if (modeStr !== "reconcile" && modeStr !== "install") {
					res.status(400).json({ error: "mode must be 'reconcile' or 'install'" });
					return;
				}
				reconcileMode = modeStr as "reconcile" | "install";
			}

			// 1. Discover source items
			const discovered = await discoverMigrationItems(include, configSource);

			// 2. Build source item states with checksums
			const sourceItems: SourceItemState[] = [];
			for (const agent of discovered.agents) {
				try {
					sourceItems.push(
						buildSourceItemState(agent, "agent", selectedProviders, {
							onConversionFallback: warnConversionFallback,
						}),
					);
				} catch (error) {
					warnReadFailure("agent", agent.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			for (const command of discovered.commands) {
				try {
					sourceItems.push(
						buildSourceItemState(command, "command", selectedProviders, {
							onConversionFallback: warnConversionFallback,
						}),
					);
				} catch (error) {
					warnReadFailure("command", command.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			for (const skill of discovered.skills) {
				// Skills use directory path, try SKILL.md first, then README.md fallback
				try {
					const skillMdPath = `${skill.path}/SKILL.md`;
					const readmePath = `${skill.path}/README.md`;

					let content: string;
					if (existsSync(skillMdPath)) {
						content = await readFile(skillMdPath, "utf-8");
					} else if (existsSync(readmePath)) {
						content = await readFile(readmePath, "utf-8");
					} else {
						console.warn(
							`[migrate] Skill "${sanitizeUntrusted(skill.name, 80)}" has neither SKILL.md nor README.md, skipping`,
						);
						continue;
					}

					sourceItems.push({
						...buildSourceItemState(
							{
								name: skill.name,
								description: skill.description,
								type: "skill",
								sourcePath: skill.path,
								frontmatter: {},
								body: content,
							},
							"skill",
							selectedProviders,
							{
								onConversionFallback: warnConversionFallback,
							},
						),
					});
				} catch (error) {
					warnReadFailure("skill", skill.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			if (discovered.configItem) {
				try {
					sourceItems.push(
						buildSourceItemState(discovered.configItem, "config", selectedProviders, {
							onConversionFallback: warnConversionFallback,
						}),
					);
				} catch (error) {
					warnReadFailure("config", "CLAUDE.md", error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			for (const rule of discovered.ruleItems) {
				try {
					sourceItems.push(
						buildSourceItemState(rule, "rules", selectedProviders, {
							onConversionFallback: warnConversionFallback,
						}),
					);
				} catch (error) {
					warnReadFailure("rule", rule.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			for (const hook of discovered.hookItems) {
				try {
					sourceItems.push(
						buildSourceItemState(hook, "hooks", selectedProviders, {
							onConversionFallback: warnConversionFallback,
						}),
					);
				} catch (error) {
					warnReadFailure("hook", hook.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			// 3. Load registry
			const registry = await readPortableRegistry();

			// 4. Build target states for all registry paths
			const targetStates = await buildTargetStates(registry.installations, {
				onReadFailure: (entryPath, error) => warnReadFailure("registry-target", entryPath, error),
			});

			// 5. Load manifest (use agent source path as kit path)
			const manifest = discovered.sourcePaths.agents
				? await loadPortableManifest(discovered.sourcePaths.agents)
				: null;

			// 6. Build provider configs
			const providerConfigs: ReconcileProviderInput[] = selectedProviders.map((provider) => ({
				provider,
				global: globalParam,
			}));

			// P2: Build type directory states for empty-dir override logic.
			// Only computed when reinstallEmptyDirs is enabled (default: true).
			const enabledTypes = (
				["agent", "command", "skill", "config", "rules", "hooks"] as const
			).filter((type) => {
				const key =
					type === "agent"
						? "agents"
						: type === "command"
							? "commands"
							: type === "skill"
								? "skills"
								: type === "config"
									? "config"
									: type === "rules"
										? "rules"
										: "hooks";
				return include[key as keyof typeof include];
			});

			const typeDirectoryStates = reinstallEmptyDirs
				? buildTypeDirectoryStates(
						providerConfigs.map((p) => ({
							provider: p.provider as ProviderTypeValue,
							global: p.global,
						})),
						enabledTypes,
					)
				: undefined;

			// 7. Run reconcile
			const input: ReconcileInput = {
				sourceItems,
				registry,
				targetStates,
				manifest,
				providerConfigs,
				typeDirectoryStates,
				respectDeletions,
			};

			const plan = reconcile(input);

			// P2: Compute suggestedMode (decisions Q6: any unknown checksum → Install mode)
			const hasUnknownChecksum = registry.installations.some(
				(inst) => isUnknownChecksum(inst.sourceChecksum) || isUnknownChecksum(inst.targetChecksum),
			);
			const suggestedMode: "reconcile" | "install" = hasUnknownChecksum ? "install" : "reconcile";

			const planWithMeta = {
				...plan,
				meta: {
					include,
					providers: selectedProviders,
					source: configSource,
					mode: reconcileMode,
					items: {
						agents: discovered.agents.map((item) => item.name),
						commands: discovered.commands.map((item) => item.name),
						skills: discovered.skills.map((item) => item.name),
						config: discovered.configItem ? [discovered.configItem.name] : [],
						rules: discovered.ruleItems.map((item) => item.name),
						hooks: discovered.hookItems.map((item) => item.name),
					},
				},
			};

			res.status(200).json({
				plan: planWithMeta,
				suggestedMode,
			});
		} catch (error) {
			res.status(500).json({
				error: "Failed to compute reconcile plan",
				message: sanitizeUntrusted(error, 260),
			});
		}
	});

	// GET /api/migrate/install-discovery - discover install candidates for Install mode
	// Returns flat type-grouped list without running reconcile or computing checksums.
	// Purpose: power the Install mode picker; fast (<100ms typical).
	app.get("/api/migrate/install-discovery", async (req: Request, res: Response) => {
		try {
			const providersParsed = parseProvidersFromQuery(req.query.providers);
			if (!providersParsed.ok || !providersParsed.value) {
				res.status(400).json({ error: providersParsed.error || "Invalid providers parameter" });
				return;
			}
			const selectedProviders = providersParsed.value;

			const includeParsed = parseIncludeOptionsStrict(
				{
					agents: req.query.agents,
					commands: req.query.commands,
					skills: req.query.skills,
					config: req.query.config,
					rules: req.query.rules,
					hooks: req.query.hooks,
				},
				"",
			);
			if (!includeParsed.ok || !includeParsed.value) {
				res.status(400).json({ error: includeParsed.error || "Invalid include options" });
				return;
			}
			const include = includeParsed.value;

			const globalParsed = parseBooleanLike(req.query.global);
			if (!globalParsed.ok) {
				res.status(400).json({ error: `global ${globalParsed.error}` });
				return;
			}
			const globalParam = globalParsed.value === true;

			const sourceParsed = parseConfigSource(req.query.source);
			if (!sourceParsed.ok) {
				res.status(400).json({ error: sourceParsed.error || "Invalid source value" });
				return;
			}
			const configSource = sourceParsed.value;

			// Discover source items (no reconcile, no checksum computation)
			const discovered = await discoverMigrationItems(include, configSource);

			// Cross-reference registry for alreadyInstalled detection
			const registry = await readPortableRegistry();

			// Build flat candidates list grouped by type
			interface InstallCandidate {
				item: string;
				type: PortableType;
				provider: string;
				global: boolean;
				isDirectoryItem: boolean;
				description?: string;
				sourcePath: string;
				alreadyInstalled: boolean;
				registryPath?: string;
			}

			const candidates: InstallCandidate[] = [];

			function addCandidates(
				items: Array<{ name: string; description?: string; sourcePath?: string; path?: string }>,
				type: PortableType,
				isDirectoryItem: boolean,
			): void {
				for (const item of items) {
					const sourcePath = item.sourcePath ?? item.path ?? "";
					for (const provider of selectedProviders) {
						// Check registry for any installation of this item+type+provider combo
						const registryEntry = registry.installations.find(
							(inst) =>
								inst.item === item.name &&
								inst.type === type &&
								inst.provider === provider &&
								inst.global === globalParam,
						);
						const alreadyInstalled = registryEntry !== undefined;

						candidates.push({
							item: item.name,
							type,
							provider,
							global: globalParam,
							isDirectoryItem,
							description: item.description,
							sourcePath,
							alreadyInstalled,
							registryPath: alreadyInstalled ? registryEntry?.path : undefined,
						});
					}
				}
			}

			if (include.agents) {
				addCandidates(
					discovered.agents.map((a) => ({
						name: a.name,
						description: a.description,
						sourcePath: a.sourcePath ?? "",
					})),
					"agent",
					false,
				);
			}
			if (include.commands) {
				addCandidates(
					discovered.commands.map((c) => ({
						name: c.name,
						description: c.description,
						sourcePath: c.sourcePath ?? "",
					})),
					"command",
					false,
				);
			}
			if (include.skills) {
				addCandidates(
					discovered.skills.map((s) => ({
						name: s.name,
						description: s.description,
						path: s.path,
					})),
					"skill",
					true, // Skills are directory-based
				);
			}
			if (include.config && discovered.configItem) {
				addCandidates(
					[
						{
							name: discovered.configItem.name,
							description: undefined,
							sourcePath: discovered.configItem.sourcePath ?? "",
						},
					],
					"config",
					false,
				);
			}
			if (include.rules) {
				addCandidates(
					discovered.ruleItems.map((r) => ({
						name: r.name,
						description: undefined,
						sourcePath: r.sourcePath ?? "",
					})),
					"rules",
					false,
				);
			}
			if (include.hooks) {
				addCandidates(
					discovered.hookItems.map((h) => ({
						name: h.name,
						description: undefined,
						sourcePath: h.sourcePath ?? "",
					})),
					"hooks",
					false,
				);
			}

			// Build type directory states for banner parity
			const providerConfigs = selectedProviders.map((provider) => ({
				provider: provider as ProviderTypeValue,
				global: globalParam,
			}));
			const enabledTypes = (
				["agent", "command", "skill", "config", "rules", "hooks"] as const
			).filter((type) => {
				const key =
					type === "agent"
						? "agents"
						: type === "command"
							? "commands"
							: type === "skill"
								? "skills"
								: type === "config"
									? "config"
									: type === "rules"
										? "rules"
										: "hooks";
				return include[key as keyof typeof include];
			});
			const typeDirectoryStates = buildTypeDirectoryStates(providerConfigs, enabledTypes);

			res.status(200).json({ candidates, typeDirectoryStates });
		} catch (error) {
			res.status(500).json({
				error: "Failed to discover install candidates",
				message: sanitizeUntrusted(error, 260),
			});
		}
	});

	// POST /api/migrate/execute - execute migration (with optional plan + resolutions)
	app.post("/api/migrate/execute", async (req: Request, res: Response) => {
		try {
			// Check if this is plan-based execution (Phase 5) or legacy execution
			const planBased = req.body?.plan !== undefined;

			if (planBased) {
				// Plan-based execution with strict payload validation
				const payloadParsed = PLAN_EXECUTE_PAYLOAD_SCHEMA.safeParse(req.body);
				if (!payloadParsed.success) {
					res.status(400).json({
						error: payloadParsed.error.issues[0]?.message || "Invalid plan execution payload",
					});
					return;
				}
				const parity = validatePlanParity(payloadParsed.data.plan);
				if (!parity.ok || !parity.value) {
					res.status(400).json({ error: parity.error || "Invalid plan summary" });
					return;
				}
				const plan = parity.value;
				const resolutionsObj: Record<string, ConflictResolution> = payloadParsed.data.resolutions;
				// Install mode treats the plan as authoritative — no type-level fallbacks.
				// See #740: previously the skills fallback installed all discovered skills
				// whenever plan had zero skill actions, leaking scope into unselected types.
				const executionMode = payloadParsed.data.mode ?? "reconcile";

				// Apply resolutions to conflicted actions
				const resolutionsMap = new Map(Object.entries(resolutionsObj));

				for (const action of plan.actions) {
					if (action.action === "conflict") {
						const key = getConflictKey(action);
						const legacyKey = getLegacyConflictKey(action);
						const resolution = resolutionsMap.get(key) || resolutionsMap.get(legacyKey);

						if (!resolution) {
							res.status(409).json({
								error: `Unresolved conflict: ${action.provider}/${action.type}/${action.item}`,
							});
							return;
						}

						// Apply resolution
						action.resolution = resolution;

						// Convert conflict to appropriate action based on resolution
						if (resolution.type === "overwrite") {
							action.action = "update";
						} else if (resolution.type === "keep") {
							action.action = "skip";
						} else if (resolution.type === "smart-merge") {
							action.action = "update"; // Will use merge logic during execution
						}
					}
				}

				// Execute the resolved plan
				const execActions = plan.actions.filter(shouldExecuteAction);
				const deleteActions = plan.actions.filter((a) => a.action === "delete");

				// Re-discover source items to get file content for installation
				const includeFromPlan = getIncludeFromPlan(plan);
				const configSourceFromPlan = getConfigSourceFromPlan(plan);
				const discovered = await discoverMigrationItems(includeFromPlan, configSourceFromPlan);

				const agentByName = new Map(discovered.agents.map((item) => [item.name, item]));
				const commandByName = new Map(discovered.commands.map((item) => [item.name, item]));
				const skillByName = new Map(discovered.skills.map((item) => [item.name, item]));
				const configByName = new Map(
					discovered.configItem ? [[discovered.configItem.name, discovered.configItem]] : [],
				);
				const ruleByName = new Map(discovered.ruleItems.map((item) => [item.name, item]));
				const hookByName = new Map(discovered.hookItems.map((item) => [item.name, item]));

				const allResults: PortableInstallResult[] = [];
				const warnings: string[] = [];
				const hookRegistrationResults: PortableInstallResult[] = [];
				const successfulHookFiles = new Map<string, { files: string[]; global: boolean }>();
				// Absolute paths of installed hook files per provider — needed for Codex wrapper generation.
				const successfulHookAbsPaths = new Map<string, string[]>();

				for (const action of execActions) {
					const provider = action.provider as ProviderTypeValue;
					const installOpts = { global: action.global };
					const actionType = action.type as PortableType;

					if (!providerSupportsType(provider, actionType)) {
						allResults.push(
							createSkippedActionResult(
								action,
								`Provider ${provider} does not support ${action.type}`,
							),
						);
						continue;
					}

					if (action.type === "agent") {
						const item = agentByName.get(action.item);
						if (!item) {
							allResults.push(
								createSkippedActionResult(action, `Source agent "${action.item}" not found`),
							);
							continue;
						}
						const batch = await installPortableItems([item], [provider], "agent", installOpts);
						tagResults(batch, "agents", action.item);
						allResults.push(...batch);
					} else if (action.type === "command") {
						const item = commandByName.get(action.item);
						if (!item) {
							allResults.push(
								createSkippedActionResult(action, `Source command "${action.item}" not found`),
							);
							continue;
						}
						const batch = await installPortableItems([item], [provider], "command", installOpts);
						tagResults(batch, "commands", action.item);
						allResults.push(...batch);
					} else if (action.type === "skill") {
						const item = skillByName.get(action.item);
						if (!item) {
							allResults.push(
								createSkippedActionResult(action, `Source skill "${action.item}" not found`),
							);
							continue;
						}
						const batch = await installSkillDirectories([item], [provider], installOpts);
						tagResults(batch, "skills", action.item);
						allResults.push(...batch);
					} else if (action.type === "config") {
						const item = configByName.get(action.item);
						if (!item) {
							allResults.push(
								createSkippedActionResult(action, `Source config "${action.item}" not found`),
							);
							continue;
						}
						const batch = await installPortableItems([item], [provider], "config", installOpts);
						tagResults(batch, "config", action.item);
						allResults.push(...batch);
					} else if (action.type === "rules") {
						const item = ruleByName.get(action.item);
						if (!item) {
							allResults.push(
								createSkippedActionResult(action, `Source rule "${action.item}" not found`),
							);
							continue;
						}
						const batch = await installPortableItems([item], [provider], "rules", installOpts);
						tagResults(batch, "rules", action.item);
						allResults.push(...batch);
					} else if (action.type === "hooks") {
						const item = hookByName.get(action.item);
						if (!item) {
							allResults.push(
								createSkippedActionResult(action, `Source hook "${action.item}" not found`),
							);
							continue;
						}
						const batch = await installPortableItems([item], [provider], "hooks", installOpts);
						tagResults(batch, "hooks", action.item);
						allResults.push(...batch);
						// Track successfully installed hook filenames for settings.json merge
						for (const r of batch.filter((r) => r.success && !r.skipped)) {
							const entry = successfulHookFiles.get(provider) ?? {
								files: [],
								global: action.global,
							};
							entry.files.push(basename(r.path));
							successfulHookFiles.set(provider, entry);
							// Track absolute paths for Codex wrapper generation
							if (r.path.length > 0) {
								const absEntry = successfulHookAbsPaths.get(provider) ?? [];
								absEntry.push(resolve(r.path));
								successfulHookAbsPaths.set(provider, absEntry);
							}
						}
					}
				}

				// After all actions, merge hooks into target settings.json per provider
				for (const [hooksProvider, entry] of successfulHookFiles) {
					if (entry.files.length === 0) continue;
					const mergeResult = await migrateHooksSettings({
						// Source is claude-code — the merger dynamically checks settingsJsonPath,
						// so any provider with hooks configuration can serve as source in the future.
						sourceProvider: "claude-code",
						targetProvider: hooksProvider as ProviderTypeValue,
						installedHookFiles: entry.files,
						installedHookAbsolutePaths: successfulHookAbsPaths.get(hooksProvider),
						global: entry.global,
					});
					recordHookRegistrationOutcome(
						hooksProvider as ProviderTypeValue,
						mergeResult,
						warnings,
						hookRegistrationResults,
					);
				}

				const allPlanProviders = getProvidersFromPlan(plan);

				// Handle skills fallback (directory-based, may not be in reconcile actions).
				// In install mode, the plan is authoritative — skip the fallback entirely
				// when include.skills is false. When include.skills is true, an empty
				// allowedSkillNames means "no skills selected" (not "install everything").
				const plannedSkillActions = execActions.filter((a) => a.type === "skill").length;
				if (includeFromPlan.skills && discovered.skills.length > 0 && plannedSkillActions === 0) {
					const allowedSkillNames = getPlanItemsByType(plan, "skills");
					const plannedSkills =
						allowedSkillNames.length > 0
							? discovered.skills.filter((skill) => allowedSkillNames.includes(skill.name))
							: executionMode === "install"
								? []
								: discovered.skills;
					const skillProviders = allPlanProviders.filter((provider) =>
						providerSupportsType(provider, "skill"),
					);
					if (skillProviders.length > 0) {
						const globalFromPlan = plan.actions[0]?.global ?? false;
						for (const skill of plannedSkills) {
							const batch = await installSkillDirectories([skill], skillProviders, {
								global: globalFromPlan,
							});
							tagResults(batch, "skills", skill.name);
							allResults.push(...batch);
						}
					}
				}

				// Execute delete actions
				const writtenPaths = new Set(
					allResults
						.filter((r) => r.success && !r.skipped && r.path.length > 0)
						.map((r) => resolve(r.path)),
				);

				for (const deleteAction of deleteActions) {
					const deleteResult = await executePlanDeleteAction(deleteAction, {
						preservePaths: writtenPaths,
					});
					deleteResult.portableType = deleteAction.type;
					deleteResult.itemName = deleteAction.item;
					allResults.push(deleteResult);
				}

				try {
					const registry = await readPortableRegistry();
					// Cast: Zod schema uses z.string() for reasonCode (client data); ReconcileAction
					// uses the narrower ReconcileReason union. Backfill only reads action/targetPath/checksums.
					await backfillRegistryChecksums(
						plan.actions as import("@/commands/portable/reconcile-types.js").ReconcileAction[],
						registry,
					);
				} catch {
					// Best-effort registry healing only; stale checksums can be retried later.
				}

				// Clean up stale codex config.toml entries (both sentinel-wrapped and legacy)
				// and update appliedManifestVersion — mirrors migrate-command.ts post-migration steps.
				for (const provider of allPlanProviders) {
					if (providers[provider]?.agents?.writeStrategy !== "codex-toml") continue;
					// Collect all distinct scopes for this provider (handles mixed global+project plans)
					const providerScopes = [
						...new Set(
							plan.actions
								.filter((a) => a.provider === provider)
								.map((a) => a.global)
								.filter((g): g is boolean => g !== undefined),
						),
					];
					if (providerScopes.length === 0) providerScopes.push(false);

					for (const scope of providerScopes) {
						const staleSlugs = await cleanupStaleCodexConfigEntries({
							global: scope,
							provider,
						});
						if (staleSlugs.length > 0) {
							const staleSlugSet = new Set(staleSlugs.map((s) => `${s}.toml`));
							await removeInstallationsByFilter(
								(i) =>
									i.type === "agent" &&
									i.provider === provider &&
									i.global === scope &&
									staleSlugSet.has(basename(i.path)),
							);
						}
					}
				}
				try {
					const agentSrc = getAgentSourcePath();
					const cmdSrc = getCommandSourcePath();
					const skillSrc = getSkillSourcePath();
					const kitRoot =
						(agentSrc ? resolve(agentSrc, "..") : null) ??
						(cmdSrc ? resolve(cmdSrc, "..") : null) ??
						(skillSrc ? resolve(skillSrc, "..") : null) ??
						null;
					const manifest = kitRoot ? await loadPortableManifest(kitRoot) : null;
					if (manifest?.cliVersion) {
						await updateAppliedManifestVersion(manifest.cliVersion);
					}
				} catch {
					// Non-critical — migration already succeeded
				}

				const responseResults = [...allResults, ...hookRegistrationResults];
				const sortedResults = sortPortableInstallResults(responseResults);
				const counts = toExecutionCounts(sortedResults);
				// Detect collisions for each scope present in the plan (#450).
				// If no actions define `global`, planScopes is [] and no collision detection runs —
				// this is safe because undefined-scope actions can't produce path conflicts.
				const planScopes = [
					...new Set(
						plan.actions.map((a) => a.global).filter((s): s is boolean => s !== undefined),
					),
				];
				const providerCollisions = planScopes.flatMap((scope) =>
					detectProviderPathCollisions(allPlanProviders, { global: scope }),
				);
				annotateResultsWithCollisions(sortedResults, providerCollisions);

				res.status(200).json({
					results: sortedResults,
					warnings,
					counts,
					discovery: toDiscoveryCounts(allResults),
					providerCollisions,
				});
				return;
			}

			// Legacy execution path (no plan)
			const providersParsed = parseProvidersFromBody(req.body?.providers);
			if (!providersParsed.ok || !providersParsed.value) {
				res.status(400).json({ error: providersParsed.error || "Invalid providers" });
				return;
			}
			const selectedProviders = providersParsed.value;

			const includeParsed = parseIncludeOptionsStrict(req.body?.include, "");
			if (!includeParsed.ok || !includeParsed.value) {
				res.status(400).json({ error: includeParsed.error || "Invalid include options" });
				return;
			}
			const include = includeParsed.value;

			const globalParsed = parseBooleanLike(req.body?.global);
			if (!globalParsed.ok) {
				res.status(400).json({ error: `global ${globalParsed.error}` });
				return;
			}
			const requestedGlobal = globalParsed.value === true;

			const sourceParsed = parseConfigSource(req.body?.source);
			if (!sourceParsed.ok) {
				res.status(400).json({ error: sourceParsed.error || "Invalid source value" });
				return;
			}
			const configSource = sourceParsed.value;

			const codexCommandsRequireGlobal =
				include.commands &&
				selectedProviders.includes("codex") &&
				providers.codex.commands !== null &&
				providers.codex.commands.projectPath === null;
			const effectiveGlobal = requestedGlobal || codexCommandsRequireGlobal;
			const warnings: string[] = [];

			if (codexCommandsRequireGlobal && !requestedGlobal) {
				warnings.push(
					"Codex commands are global-only; scope was automatically switched to global.",
				);
			}

			const discovered = await discoverMigrationItems(include, configSource);

			const hasItems =
				discovered.agents.length > 0 ||
				discovered.commands.length > 0 ||
				discovered.skills.length > 0 ||
				discovered.configItem !== null ||
				discovered.ruleItems.length > 0 ||
				discovered.hookItems.length > 0;

			if (!hasItems) {
				res.status(200).json({
					results: [],
					warnings,
					effectiveGlobal,
					counts: { installed: 0, skipped: 0, failed: 0 },
					discovery: emptyDiscoveryCounts(),
					providerCollisions: [],
					unsupportedByType: {
						agents: [],
						commands: [],
						skills: [],
						config: [],
						rules: [],
						hooks: [],
					},
				});
				return;
			}

			const installOptions = { global: effectiveGlobal };
			const results: Awaited<ReturnType<typeof installPortableItems>> = [];
			const hookRegistrationResults: PortableInstallResult[] = [];
			const successfulHookFiles = new Map<ProviderTypeValue, string[]>();
			// Absolute paths per provider — needed for Codex wrapper generation.
			const successfulHookAbsPaths = new Map<ProviderTypeValue, string[]>();

			const unsupportedByType = {
				agents: include.agents
					? selectedProviders.filter(
							(provider) => !getProvidersSupporting("agents").includes(provider),
						)
					: [],
				commands: include.commands
					? selectedProviders.filter(
							(provider) => !getProvidersSupporting("commands").includes(provider),
						)
					: [],
				skills: include.skills
					? selectedProviders.filter(
							(provider) => !getProvidersSupporting("skills").includes(provider),
						)
					: [],
				config: include.config
					? selectedProviders.filter(
							(provider) => !getProvidersSupporting("config").includes(provider),
						)
					: [],
				rules: include.rules
					? selectedProviders.filter(
							(provider) => !getProvidersSupporting("rules").includes(provider),
						)
					: [],
				hooks: include.hooks
					? selectedProviders.filter(
							(provider) => !getProvidersSupporting("hooks").includes(provider),
						)
					: [],
			};

			if (include.agents && discovered.agents.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("agents").includes(provider),
				);
				if (providersForType.length > 0) {
					const batches = await Promise.all(
						discovered.agents.map(async (agent) => {
							const batch = await installPortableItems(
								[agent],
								providersForType,
								"agent",
								installOptions,
							);
							tagResults(batch, "agents", agent.name);
							return batch;
						}),
					);
					for (const batch of batches) {
						results.push(...batch);
					}
				}
			}

			if (include.commands && discovered.commands.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("commands").includes(provider),
				);
				if (providersForType.length > 0) {
					const batches = await Promise.all(
						discovered.commands.map(async (command) => {
							const batch = await installPortableItems(
								[command],
								providersForType,
								"command",
								installOptions,
							);
							tagResults(batch, "commands", command.name);
							return batch;
						}),
					);
					for (const batch of batches) {
						results.push(...batch);
					}
				}
			}

			if (include.skills && discovered.skills.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("skills").includes(provider),
				);
				if (providersForType.length > 0) {
					const batches = await Promise.all(
						discovered.skills.map(async (skill) => {
							const batch = await installSkillDirectories(
								[skill],
								providersForType,
								installOptions,
							);
							tagResults(batch, "skills", skill.name);
							return batch;
						}),
					);
					for (const batch of batches) {
						results.push(...batch);
					}
				}
			}

			if (include.config && discovered.configItem) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("config").includes(provider),
				);
				if (providersForType.length > 0) {
					const batch = await installPortableItems(
						[discovered.configItem],
						providersForType,
						"config",
						installOptions,
					);
					tagResults(batch, "config");
					results.push(...batch);
				}
			}

			if (include.rules && discovered.ruleItems.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("rules").includes(provider),
				);
				if (providersForType.length > 0) {
					const batches = await Promise.all(
						discovered.ruleItems.map(async (rule) => {
							const batch = await installPortableItems(
								[rule],
								providersForType,
								"rules",
								installOptions,
							);
							tagResults(batch, "rules", rule.name);
							return batch;
						}),
					);
					for (const batch of batches) {
						results.push(...batch);
					}
				}
			}

			if (include.hooks && discovered.hookItems.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("hooks").includes(provider),
				);
				if (providersForType.length > 0) {
					const batches = await Promise.all(
						discovered.hookItems.map(async (hook) => {
							const batch = await installPortableItems(
								[hook],
								providersForType,
								"hooks",
								installOptions,
							);
							tagResults(batch, "hooks", hook.name);
							for (const result of batch.filter((entry) => entry.success && !entry.skipped)) {
								const existing = successfulHookFiles.get(result.provider) ?? [];
								existing.push(basename(result.path));
								successfulHookFiles.set(result.provider, existing);
								// Track absolute paths for Codex wrapper generation
								if (result.path.length > 0) {
									const absExisting = successfulHookAbsPaths.get(result.provider) ?? [];
									absExisting.push(resolve(result.path));
									successfulHookAbsPaths.set(result.provider, absExisting);
								}
							}
							return batch;
						}),
					);
					for (const batch of batches) {
						results.push(...batch);
					}
				}
			}

			for (const [provider, files] of successfulHookFiles) {
				if (files.length === 0) continue;
				const mergeResult = await migrateHooksSettings({
					sourceProvider: "claude-code",
					targetProvider: provider,
					installedHookFiles: files,
					installedHookAbsolutePaths: successfulHookAbsPaths.get(provider),
					global: effectiveGlobal,
				});
				recordHookRegistrationOutcome(provider, mergeResult, warnings, hookRegistrationResults);
			}

			const responseResults = [...results, ...hookRegistrationResults];
			const sortedResults = sortPortableInstallResults(responseResults);
			const counts = toExecutionCounts(sortedResults);
			const providerCollisions = detectProviderPathCollisions(selectedProviders, installOptions);
			annotateResultsWithCollisions(sortedResults, providerCollisions);

			res.status(200).json({
				results: sortedResults,
				warnings,
				effectiveGlobal,
				counts,
				discovery: toDiscoveryCounts(results),
				unsupportedByType,
				providerCollisions,
			});
		} catch (error) {
			res.status(500).json({
				error: "Failed to execute migration",
				message: sanitizeUntrusted(error, 260),
			});
		}
	});
}
