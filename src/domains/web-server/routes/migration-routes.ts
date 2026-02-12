/**
 * Migration API routes
 */

import { discoverAgents, getAgentSourcePath } from "@/commands/agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "@/commands/commands/commands-discovery.js";
import { installSkillDirectories } from "@/commands/port/skill-directory-installer.js";
import { discoverConfig, discoverRules } from "@/commands/portable/config-discovery.js";
import { installPortableItems } from "@/commands/portable/portable-installer.js";
import {
	detectInstalledProviders,
	getProvidersSupporting,
	providers,
} from "@/commands/portable/provider-registry.js";
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
			const allProviders = Object.keys(providers) as ProviderTypeValue[];

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

	// POST /api/migrate/execute - run non-interactive migration
	app.post("/api/migrate/execute", async (req: Request, res: Response) => {
		try {
			const selectedProvidersRaw = req.body?.providers;
			if (!Array.isArray(selectedProvidersRaw) || selectedProvidersRaw.length === 0) {
				res.status(400).json({ error: "providers is required and must be a non-empty array" });
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
