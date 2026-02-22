/**
 * Migration API routes
 */

import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { discoverAgents, getAgentSourcePath } from "@/commands/agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "@/commands/commands/commands-discovery.js";
import { installSkillDirectories } from "@/commands/migrate/skill-directory-installer.js";
import { computeContentChecksum } from "@/commands/portable/checksum-utils.js";
import {
	discoverConfig,
	discoverRules,
	getConfigSourcePath,
} from "@/commands/portable/config-discovery.js";
import { installPortableItems } from "@/commands/portable/portable-installer.js";
import { loadPortableManifest } from "@/commands/portable/portable-manifest.js";
import {
	readPortableRegistry,
	removePortableInstallation,
} from "@/commands/portable/portable-registry.js";
import {
	detectInstalledProviders,
	getProvidersSupporting,
	providers,
} from "@/commands/portable/provider-registry.js";
import type {
	ConflictResolution,
	ReconcileInput,
	ReconcileProviderInput,
	SourceItemState,
	TargetFileState,
} from "@/commands/portable/reconcile-types.js";
import { reconcile } from "@/commands/portable/reconciler.js";
import type {
	PortableInstallResult,
	ProviderType as ProviderTypeValue,
} from "@/commands/portable/types.js";
import { ProviderType } from "@/commands/portable/types.js";
import { discoverSkills, getSkillSourcePath } from "@/commands/skills/skills-discovery.js";
import type { Express, Request, Response } from "express";
import { z } from "zod";

type MigrationPortableType = "agents" | "commands" | "skills" | "config" | "rules";

interface MigrationIncludeOptions {
	agents: boolean;
	commands: boolean;
	skills: boolean;
	config: boolean;
	rules: boolean;
}

const MIGRATION_TYPES: MigrationPortableType[] = [
	"agents",
	"commands",
	"skills",
	"config",
	"rules",
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
		type: z.enum(["agent", "command", "skill", "config", "rules"]),
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
	})
	.passthrough();

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
	})
	.passthrough();

const PLAN_EXECUTE_PAYLOAD_SCHEMA = z
	.object({
		plan: RECONCILE_PLAN_SCHEMA,
		resolutions: z.record(CONFLICT_RESOLUTION_SCHEMA).optional().default({}),
	})
	.passthrough();

interface DiscoveryResult {
	agents: Awaited<ReturnType<typeof discoverAgents>>;
	commands: Awaited<ReturnType<typeof discoverCommands>>;
	skills: Awaited<ReturnType<typeof discoverSkills>>;
	configItem: Awaited<ReturnType<typeof discoverConfig>>;
	ruleItems: Awaited<ReturnType<typeof discoverRules>>;
	sourcePaths: {
		agents: string | null;
		commands: string | null;
		skills: string | null;
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
		if (normalized === "true" || normalized === "1") {
			return { ok: true, value: true };
		}
		if (normalized === "false" || normalized === "0") {
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
	for (const type of MIGRATION_TYPES) {
		const parsed = parseBooleanLike(raw[type]);
		if (!parsed.ok) {
			return { ok: false, error: `${labelPrefix}${type} ${parsed.error}` };
		}
		if (parsed.value !== undefined) {
			partial[type] = parsed.value;
		}
	}

	const include = normalizeIncludeOptions(partial);
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

	if (normalizedTokens.length > MAX_PROVIDER_COUNT) {
		return { ok: false, error: maxCountMessage };
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
	const globalSourcePath = resolve(getConfigSourcePath());
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
			action.type as "agent" | "command" | "skill" | "config" | "rules",
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

async function discoverMigrationItems(
	include: MigrationIncludeOptions,
	configSource?: string,
): Promise<DiscoveryResult> {
	const agentsSource = include.agents ? getAgentSourcePath() : null;
	const commandsSource = include.commands ? getCommandSourcePath() : null;
	const skillsSource = include.skills ? getSkillSourcePath() : null;

	const [agents, commands, skills, configItem, ruleItems] = await Promise.all([
		agentsSource ? discoverAgents(agentsSource) : Promise.resolve([]),
		commandsSource ? discoverCommands(commandsSource) : Promise.resolve([]),
		skillsSource ? discoverSkills(skillsSource) : Promise.resolve([]),
		include.config ? discoverConfig(configSource) : Promise.resolve(null),
		include.rules ? discoverRules() : Promise.resolve([]),
	]);

	return {
		agents,
		commands,
		skills,
		configItem,
		ruleItems,
		sourcePaths: {
			agents: agentsSource,
			commands: commandsSource,
			skills: skillsSource,
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
					recommended: provider === "codex" || provider === "antigravity",
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
			};
			const discovered = await discoverMigrationItems(includeAll);

			res.status(200).json({
				sourcePaths: discovered.sourcePaths,
				counts: {
					agents: discovered.agents.length,
					commands: discovered.commands.length,
					skills: discovered.skills.length,
					config: discovered.configItem ? 1 : 0,
					rules: discovered.ruleItems.length,
				},
				items: {
					agents: discovered.agents.map((item) => item.name),
					commands: discovered.commands.map((item) => item.displayName || item.name),
					skills: discovered.skills.map((item) => item.name),
					config: discovered.configItem ? [discovered.configItem.name] : [],
					rules: discovered.ruleItems.map((item) => item.name),
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

			// 1. Discover source items
			const discovered = await discoverMigrationItems(include, configSource);

			// 2. Build source item states with checksums
			const sourceItems: SourceItemState[] = [];
			for (const agent of discovered.agents) {
				try {
					const content = await readFile(agent.sourcePath, "utf-8");
					const sourceChecksum = computeContentChecksum(content);
					const convertedChecksums: Record<string, string> = {};

					for (const provider of selectedProviders) {
						// For now, assume all providers use same format (will enhance for provider-specific conversions)
						convertedChecksums[provider] = sourceChecksum;
					}

					sourceItems.push({
						item: agent.name,
						type: "agent",
						sourceChecksum,
						convertedChecksums,
					});
				} catch (error) {
					warnReadFailure("agent", agent.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			for (const command of discovered.commands) {
				try {
					const content = await readFile(command.sourcePath, "utf-8");
					const sourceChecksum = computeContentChecksum(content);
					const convertedChecksums: Record<string, string> = {};

					for (const provider of selectedProviders) {
						convertedChecksums[provider] = sourceChecksum;
					}

					sourceItems.push({
						item: command.name,
						type: "command",
						sourceChecksum,
						convertedChecksums,
					});
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

					const sourceChecksum = computeContentChecksum(content);
					const convertedChecksums: Record<string, string> = {};

					for (const provider of selectedProviders) {
						convertedChecksums[provider] = sourceChecksum;
					}

					sourceItems.push({
						item: skill.name,
						type: "skill",
						sourceChecksum,
						convertedChecksums,
					});
				} catch (error) {
					warnReadFailure("skill", skill.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			if (discovered.configItem) {
				try {
					const content = await readFile(discovered.configItem.sourcePath, "utf-8");
					const sourceChecksum = computeContentChecksum(content);
					const convertedChecksums: Record<string, string> = {};

					for (const provider of selectedProviders) {
						convertedChecksums[provider] = sourceChecksum;
					}

					sourceItems.push({
						item: discovered.configItem.name,
						type: "config",
						sourceChecksum,
						convertedChecksums,
					});
				} catch (error) {
					warnReadFailure("config", "CLAUDE.md", error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			for (const rule of discovered.ruleItems) {
				try {
					const content = await readFile(rule.sourcePath, "utf-8");
					const sourceChecksum = computeContentChecksum(content);
					const convertedChecksums: Record<string, string> = {};

					for (const provider of selectedProviders) {
						convertedChecksums[provider] = sourceChecksum;
					}

					sourceItems.push({
						item: rule.name,
						type: "rules",
						sourceChecksum,
						convertedChecksums,
					});
				} catch (error) {
					warnReadFailure("rule", rule.name, error);
					// Skip this item instead of crashing entire endpoint
				}
			}

			// 3. Load registry
			const registry = await readPortableRegistry();

			// 4. Build target states for all registry paths
			const targetStates = new Map<string, TargetFileState>();
			for (const entry of registry.installations) {
				// Skills are directory-based — path points to a directory, not a file.
				// Skip them here; the reconciler already excludes skills from orphan detection.
				if (entry.type === "skill") continue;

				const exists = existsSync(entry.path);
				const state: TargetFileState = { path: entry.path, exists };

				if (exists) {
					try {
						const content = await readFile(entry.path, "utf-8");
						state.currentChecksum = computeContentChecksum(content);
					} catch (error) {
						// Path exists but cannot be checksummed as a file (e.g. directory, EACCES).
						// Keep checksum undefined so reconciler treats this as unknown.
						warnReadFailure("registry-target", entry.path, error);
					}
				}

				targetStates.set(entry.path, state);
			}

			// 5. Load manifest (use agent source path as kit path)
			const manifest = discovered.sourcePaths.agents
				? await loadPortableManifest(discovered.sourcePaths.agents)
				: null;

			// 6. Build provider configs
			const providerConfigs: ReconcileProviderInput[] = selectedProviders.map((provider) => ({
				provider,
				global: globalParam,
			}));

			// 7. Run reconcile
			const input: ReconcileInput = {
				sourceItems,
				registry,
				targetStates,
				manifest,
				providerConfigs,
			};

			const plan = reconcile(input);

			res.status(200).json({ plan });
		} catch (error) {
			res.status(500).json({
				error: "Failed to compute reconcile plan",
				message: error instanceof Error ? error.message : "Unknown error",
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

				// Apply resolutions to conflicted actions
				const resolutionsMap = new Map(Object.entries(resolutionsObj));

				for (const action of plan.actions) {
					if (action.action === "conflict") {
						const key = getConflictKey(action);
						const resolution = resolutionsMap.get(key);

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
				const includeAll: MigrationIncludeOptions = {
					agents: true,
					commands: true,
					skills: true,
					config: true,
					rules: true,
				};
				const discovered = await discoverMigrationItems(includeAll);

				const agentByName = new Map(discovered.agents.map((item) => [item.name, item]));
				const commandByName = new Map(discovered.commands.map((item) => [item.name, item]));
				const skillByName = new Map(discovered.skills.map((item) => [item.name, item]));
				const configByName = new Map(
					discovered.configItem ? [[discovered.configItem.name, discovered.configItem]] : [],
				);
				const ruleByName = new Map(discovered.ruleItems.map((item) => [item.name, item]));

				const allResults: PortableInstallResult[] = [];

				for (const action of execActions) {
					const provider = action.provider as ProviderTypeValue;
					const installOpts = { global: action.global };

					if (action.type === "agent") {
						const item = agentByName.get(action.item);
						if (!item || !getProvidersSupporting("agents").includes(provider)) continue;
						allResults.push(
							...(await installPortableItems([item], [provider], "agent", installOpts)),
						);
					} else if (action.type === "command") {
						const item = commandByName.get(action.item);
						if (!item || !getProvidersSupporting("commands").includes(provider)) continue;
						allResults.push(
							...(await installPortableItems([item], [provider], "command", installOpts)),
						);
					} else if (action.type === "skill") {
						const item = skillByName.get(action.item);
						if (!item || !getProvidersSupporting("skills").includes(provider)) continue;
						allResults.push(...(await installSkillDirectories([item], [provider], installOpts)));
					} else if (action.type === "config") {
						const item = configByName.get(action.item);
						if (!item || !getProvidersSupporting("config").includes(provider)) continue;
						allResults.push(
							...(await installPortableItems([item], [provider], "config", installOpts)),
						);
					} else if (action.type === "rules") {
						const item = ruleByName.get(action.item);
						if (!item || !getProvidersSupporting("rules").includes(provider)) continue;
						allResults.push(
							...(await installPortableItems([item], [provider], "rules", installOpts)),
						);
					}
				}

				// Handle skills fallback (directory-based, may not be in reconcile actions)
				const plannedSkillActions = execActions.filter((a) => a.type === "skill").length;
				if (discovered.skills.length > 0 && plannedSkillActions === 0) {
					const planProviders = [
						...new Set(plan.actions.map((a) => a.provider as ProviderTypeValue)),
					];
					const skillProviders = planProviders.filter((pv) =>
						getProvidersSupporting("skills").includes(pv),
					);
					if (skillProviders.length > 0) {
						const globalFromPlan = plan.actions[0]?.global ?? false;
						allResults.push(
							...(await installSkillDirectories(discovered.skills, skillProviders, {
								global: globalFromPlan,
							})),
						);
					}
				}

				// Execute delete actions
				const writtenPaths = new Set(
					allResults
						.filter((r) => r.success && !r.skipped && r.path.length > 0)
						.map((r) => resolve(r.path)),
				);

				for (const deleteAction of deleteActions) {
					allResults.push(
						await executePlanDeleteAction(deleteAction, { preservePaths: writtenPaths }),
					);
				}

				const installed = allResults.filter((r) => r.success && !r.skipped).length;
				const skipped = allResults.filter((r) => r.skipped).length;
				const failed = allResults.filter((r) => !r.success).length;

				res.status(200).json({
					results: allResults,
					warnings: [],
					counts: { installed, skipped, failed },
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
				discovered.ruleItems.length > 0;

			if (!hasItems) {
				res.status(200).json({
					results: [],
					warnings,
					effectiveGlobal,
					counts: { installed: 0, skipped: 0, failed: 0 },
					discovery: {
						agents: 0,
						commands: 0,
						skills: 0,
						config: 0,
						rules: 0,
					},
					unsupportedByType: {
						agents: [],
						commands: [],
						skills: [],
						config: [],
						rules: [],
					},
				});
				return;
			}

			const installOptions = { global: effectiveGlobal };
			const results: Awaited<ReturnType<typeof installPortableItems>> = [];

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
			};

			if (include.agents && discovered.agents.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("agents").includes(provider),
				);
				if (providersForType.length > 0) {
					results.push(
						...(await installPortableItems(
							discovered.agents,
							providersForType,
							"agent",
							installOptions,
						)),
					);
				}
			}

			if (include.commands && discovered.commands.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("commands").includes(provider),
				);
				if (providersForType.length > 0) {
					results.push(
						...(await installPortableItems(
							discovered.commands,
							providersForType,
							"command",
							installOptions,
						)),
					);
				}
			}

			if (include.skills && discovered.skills.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("skills").includes(provider),
				);
				if (providersForType.length > 0) {
					results.push(
						...(await installSkillDirectories(discovered.skills, providersForType, installOptions)),
					);
				}
			}

			if (include.config && discovered.configItem) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("config").includes(provider),
				);
				if (providersForType.length > 0) {
					results.push(
						...(await installPortableItems(
							[discovered.configItem],
							providersForType,
							"config",
							installOptions,
						)),
					);
				}
			}

			if (include.rules && discovered.ruleItems.length > 0) {
				const providersForType = selectedProviders.filter((provider) =>
					getProvidersSupporting("rules").includes(provider),
				);
				if (providersForType.length > 0) {
					results.push(
						...(await installPortableItems(
							discovered.ruleItems,
							providersForType,
							"rules",
							installOptions,
						)),
					);
				}
			}

			const installed = results.filter((item) => item.success && !item.skipped).length;
			const skipped = results.filter((item) => item.skipped).length;
			const failed = results.filter((item) => !item.success).length;

			res.status(200).json({
				results,
				warnings,
				effectiveGlobal,
				counts: { installed, skipped, failed },
				discovery: {
					agents: discovered.agents.length,
					commands: discovered.commands.length,
					skills: discovered.skills.length,
					config: discovered.configItem ? 1 : 0,
					rules: discovered.ruleItems.length,
				},
				unsupportedByType,
			});
		} catch (error) {
			res.status(500).json({
				error: "Failed to execute migration",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});
}
