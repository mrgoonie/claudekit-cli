/**
 * Migration API routes
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { discoverAgents, getAgentSourcePath } from "@/commands/agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "@/commands/commands/commands-discovery.js";
import { installSkillDirectories } from "@/commands/migrate/skill-directory-installer.js";
import { computeContentChecksum } from "@/commands/portable/checksum-utils.js";
import { discoverConfig, discoverRules } from "@/commands/portable/config-discovery.js";
import { installPortableItems } from "@/commands/portable/portable-installer.js";
import { loadPortableManifest } from "@/commands/portable/portable-manifest.js";
import { readPortableRegistry } from "@/commands/portable/portable-registry.js";
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
import type { ProviderType as ProviderTypeValue } from "@/commands/portable/types.js";
import { ProviderType } from "@/commands/portable/types.js";
import { discoverSkills, getSkillSourcePath } from "@/commands/skills/skills-discovery.js";
import type { Express, Request, Response } from "express";

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

			res.json({ providers: providerList });
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

			res.json({
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
			const providersParam = String(req.query.providers || "");
			const selectedProvidersRaw = providersParam.split(",").filter(Boolean);

			if (selectedProvidersRaw.length === 0) {
				res.status(400).json({ error: "providers parameter is required" });
				return;
			}

			const selectedProviders: ProviderTypeValue[] = [];
			for (const provider of selectedProvidersRaw) {
				const parsed = ProviderType.safeParse(provider);
				if (!parsed.success) {
					res.status(400).json({ error: `Unknown provider: ${provider}` });
					return;
				}
				selectedProviders.push(parsed.data);
			}

			const include: MigrationIncludeOptions = {
				agents: String(req.query.agents) === "true",
				commands: String(req.query.commands) === "true",
				skills: String(req.query.skills) === "true",
				config: String(req.query.config) === "true",
				rules: String(req.query.rules) === "true",
			};

			const globalParam = String(req.query.global || "false") === "true";
			const configSource = typeof req.query.source === "string" ? req.query.source : undefined;

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
					console.warn(
						`Failed to read agent ${agent.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
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
					console.warn(
						`Failed to read command ${command.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
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
						console.warn(`Skill ${skill.name} has neither SKILL.md nor README.md, skipping`);
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
					console.warn(
						`Failed to read skill ${skill.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
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
					console.warn(
						`Failed to read config: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
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
					console.warn(
						`Failed to read rule ${rule.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
					// Skip this item instead of crashing entire endpoint
				}
			}

			// 3. Load registry
			const registry = await readPortableRegistry();

			// 4. Build target states for all registry paths
			const targetStates = new Map<string, TargetFileState>();
			for (const entry of registry.installations) {
				const exists = existsSync(entry.path);
				const state: TargetFileState = { path: entry.path, exists };

				if (exists) {
					const content = await readFile(entry.path, "utf-8");
					state.currentChecksum = computeContentChecksum(content);
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

			res.json({ plan });
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
				// Plan-based execution with conflict resolutions
				const plan = req.body.plan;
				const resolutionsObj: Record<string, ConflictResolution> = req.body.resolutions || {};

				if (!plan || !plan.actions) {
					res.status(400).json({ error: "Invalid plan provided" });
					return;
				}

				// Apply resolutions to conflicted actions
				const resolutionsMap = new Map(Object.entries(resolutionsObj));

				for (const action of plan.actions) {
					if (action.action === "conflict") {
						const key = `${action.provider}:${action.type}:${action.item}:${action.global}`;
						const resolution = resolutionsMap.get(key);

						if (!resolution) {
							res.status(400).json({
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
				// Plan-based execution not yet implemented - return 501
				res.status(501).json({
					error: "Plan-based execution not yet implemented. Use standard migration endpoint.",
					phase: "planned-for-future",
				});
				return;
			}

			// Legacy execution path (no plan)
			const selectedProvidersRaw = req.body?.providers;
			if (!Array.isArray(selectedProvidersRaw) || selectedProvidersRaw.length === 0) {
				res.status(400).json({ error: "providers is required and must be a non-empty array" });
				return;
			}
			if (selectedProvidersRaw.length > 20) {
				res.status(400).json({ error: "providers array exceeds maximum of 20 entries" });
				return;
			}

			const selectedProviders: ProviderTypeValue[] = [];
			for (const provider of selectedProvidersRaw) {
				const parsed = ProviderType.safeParse(provider);
				if (!parsed.success) {
					res.status(400).json({ error: `Unknown provider: ${String(provider)}` });
					return;
				}
				selectedProviders.push(parsed.data);
			}

			const include = normalizeIncludeOptions(req.body?.include);
			if (countEnabledTypes(include) === 0) {
				res.status(400).json({ error: "At least one migration type must be enabled" });
				return;
			}

			const requestedGlobal = req.body?.global === true;
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

			const configSource = typeof req.body?.source === "string" ? req.body.source : undefined;
			const discovered = await discoverMigrationItems(include, configSource);

			const hasItems =
				discovered.agents.length > 0 ||
				discovered.commands.length > 0 ||
				discovered.skills.length > 0 ||
				discovered.configItem !== null ||
				discovered.ruleItems.length > 0;

			if (!hasItems) {
				res.json({
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

			res.json({
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
