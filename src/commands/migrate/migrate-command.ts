/**
 * Migrate command — one-shot migration of all agents, commands, skills, config,
 * and rules to target providers. Thin orchestration layer over portable infrastructure.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { logger } from "../../shared/logger.js";
import { discoverAgents, getAgentSourcePath } from "../agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "../commands/commands-discovery.js";
import { discoverConfig, discoverRules } from "../portable/config-discovery.js";
import { installPortableItems } from "../portable/portable-installer.js";
import {
	detectInstalledProviders,
	getProvidersSupporting,
	providers,
} from "../portable/provider-registry.js";
import type { PortableInstallResult, ProviderType } from "../portable/types.js";
import { discoverSkills, getSkillSourcePath } from "../skills/skills-discovery.js";
import { installSkillDirectories } from "./skill-directory-installer.js";

/** Options for ck migrate */
interface MigrateOptions {
	agent?: string[];
	global?: boolean;
	yes?: boolean;
	all?: boolean;
	config?: boolean;
	rules?: boolean;
	skipConfig?: boolean;
	skipRules?: boolean;
	source?: string;
}

/**
 * Main migrate command handler
 */
export async function migrateCommand(options: MigrateOptions): Promise<void> {
	console.log();
	p.intro(pc.bgMagenta(pc.black(" ck migrate ")));

	try {
		// --config/--rules = "only" mode (migrate just those types)
		// --no-config/--no-rules (or --skip-*) = "except" mode (migrate everything except those)
		const argv = new Set(process.argv.slice(2));
		const hasConfigArg = argv.has("--config");
		const hasRulesArg = argv.has("--rules");
		const hasNoConfigArg = argv.has("--no-config") || argv.has("--skip-config");
		const hasNoRulesArg = argv.has("--no-rules") || argv.has("--skip-rules");
		// Programmatic fallback (without CLI flags): allow a single explicit positive toggle.
		const hasNoToggleArgs = !hasConfigArg && !hasRulesArg && !hasNoConfigArg && !hasNoRulesArg;
		const fallbackConfigOnly = hasNoToggleArgs && options.config === true && options.rules !== true;
		const fallbackRulesOnly = hasNoToggleArgs && options.rules === true && options.config !== true;

		const hasOnlyFlag = hasConfigArg || hasRulesArg || fallbackConfigOnly || fallbackRulesOnly;
		const skipConfig = hasNoConfigArg || options.skipConfig === true || options.config === false;
		const skipRules = hasNoRulesArg || options.skipRules === true || options.rules === false;
		const migrateConfigOnly = hasConfigArg || fallbackConfigOnly;
		const migrateRulesOnly = hasRulesArg || fallbackRulesOnly;

		const migrateAgents = !hasOnlyFlag;
		const migrateCommands = !hasOnlyFlag;
		const migrateSkills = !hasOnlyFlag;
		const migrateConfig = hasOnlyFlag ? migrateConfigOnly && !skipConfig : !skipConfig;
		const migrateRules = hasOnlyFlag ? migrateRulesOnly && !skipRules : !skipRules;

		// Phase 1: Discover all portable items
		const spinner = p.spinner();
		spinner.start("Discovering portable items...");

		const agentSource = migrateAgents ? getAgentSourcePath() : null;
		const commandSource = migrateCommands ? getCommandSourcePath() : null;
		const skillSource = migrateSkills ? getSkillSourcePath() : null;

		const agents = agentSource ? await discoverAgents(agentSource) : [];
		const commands = commandSource ? await discoverCommands(commandSource) : [];
		const skills = skillSource ? await discoverSkills(skillSource) : [];
		const configItem = migrateConfig ? await discoverConfig(options.source) : null;
		const ruleItems = migrateRules ? await discoverRules() : [];

		spinner.stop("Discovery complete");

		const hasItems =
			agents.length > 0 ||
			commands.length > 0 ||
			skills.length > 0 ||
			configItem !== null ||
			ruleItems.length > 0;

		if (!hasItems) {
			p.log.error("Nothing to migrate.");
			p.log.info(
				pc.dim(
					"Check ~/.claude/agents/, ~/.claude/commands/, ~/.claude/skills/, and ~/.claude/CLAUDE.md",
				),
			);
			p.outro(pc.red("Nothing to migrate"));
			return;
		}

		// Show discovery summary
		const parts: string[] = [];
		if (agents.length > 0) parts.push(`${agents.length} agent(s)`);
		if (commands.length > 0) parts.push(`${commands.length} command(s)`);
		if (skills.length > 0) parts.push(`${skills.length} skill(s)`);
		if (configItem) parts.push("config");
		if (ruleItems.length > 0) parts.push(`${ruleItems.length} rule(s)`);
		p.log.info(`Found: ${parts.join(", ")}`);

		// Phase 2: Select providers
		const detectedProviders = await detectInstalledProviders();
		let selectedProviders: ProviderType[];

		if (options.agent && options.agent.length > 0) {
			// Validate provider names
			const validProviders = Object.keys(providers);
			const invalid = options.agent.filter((a) => !validProviders.includes(a));
			if (invalid.length > 0) {
				p.log.error(`Unknown provider(s): ${invalid.join(", ")}`);
				p.log.info(pc.dim(`Valid providers: ${validProviders.join(", ")}`));
				p.outro(pc.red("Invalid provider"));
				return;
			}
			selectedProviders = options.agent as ProviderType[];
		} else if (options.all) {
			// All providers that support at least one type
			const allProviders = new Set<ProviderType>([
				...getProvidersSupporting("agents"),
				...getProvidersSupporting("commands"),
				...getProvidersSupporting("skills"),
				...getProvidersSupporting("config"),
				...getProvidersSupporting("rules"),
			]);
			selectedProviders = Array.from(allProviders);
			p.log.info(`Migrating to all ${selectedProviders.length} providers`);
		} else if (detectedProviders.length === 0) {
			if (options.yes) {
				const allProviders = new Set<ProviderType>([
					...getProvidersSupporting("agents"),
					...getProvidersSupporting("commands"),
					...getProvidersSupporting("skills"),
					...getProvidersSupporting("config"),
					...getProvidersSupporting("rules"),
				]);
				selectedProviders = Array.from(allProviders);
				p.log.info("No providers detected, migrating to all");
			} else {
				p.log.warn("No providers detected on your system.");
				const allProviders = new Set<ProviderType>([
					...getProvidersSupporting("agents"),
					...getProvidersSupporting("commands"),
					...getProvidersSupporting("skills"),
					...getProvidersSupporting("config"),
					...getProvidersSupporting("rules"),
				]);
				const selected = await p.multiselect({
					message: "Select providers to migrate to",
					options: Array.from(allProviders).map((key) => ({
						value: key,
						label: providers[key].displayName,
					})),
					required: true,
				});
				if (p.isCancel(selected)) {
					p.cancel("Migrate cancelled");
					return;
				}
				selectedProviders = selected as ProviderType[];
			}
		} else if (detectedProviders.length === 1 || options.yes) {
			selectedProviders = detectedProviders;
			p.log.info(
				`Migrating to: ${detectedProviders.map((a) => pc.cyan(providers[a].displayName)).join(", ")}`,
			);
		} else {
			const selected = await p.multiselect({
				message: "Select providers to migrate to",
				options: detectedProviders.map((a) => ({
					value: a,
					label: providers[a].displayName,
				})),
				required: true,
				initialValues: detectedProviders,
			});
			if (p.isCancel(selected)) {
				p.cancel("Migrate cancelled");
				return;
			}
			selectedProviders = selected as ProviderType[];
		}

		// Phase 3: Select scope
		let installGlobally = options.global ?? false;
		if (options.global === undefined && !options.yes) {
			const scope = await p.select({
				message: "Installation scope",
				options: [
					{
						value: false,
						label: "Project",
						hint: "Install in current directory",
					},
					{
						value: true,
						label: "Global",
						hint: "Install in home directory",
					},
				],
			});
			if (p.isCancel(scope)) {
				p.cancel("Migrate cancelled");
				return;
			}
			installGlobally = scope as boolean;
		}

		// Phase 4: Summary
		console.log();
		p.log.step(pc.bold("Migrate Summary"));
		if (agents.length > 0) {
			p.log.message(`  Agents: ${agents.map((a) => pc.cyan(a.name)).join(", ")}`);
		}
		if (commands.length > 0) {
			const cmdNames = commands.map((c) => pc.cyan(`/${c.displayName || c.name}`)).join(", ");
			p.log.message(`  Commands: ${cmdNames}`);
		}
		if (skills.length > 0) {
			p.log.message(`  Skills: ${skills.map((s) => pc.cyan(s.name)).join(", ")}`);
		}
		if (configItem) {
			const lines = configItem.body.split("\n").length;
			p.log.message(`  Config: ${pc.cyan("CLAUDE.md")} (${lines} lines)`);
		}
		if (ruleItems.length > 0) {
			p.log.message(`  Rules: ${pc.cyan(`${ruleItems.length} file(s)`)}`);
		}
		const providerNames = selectedProviders
			.map((prov) => pc.cyan(providers[prov].displayName))
			.join(", ");
		p.log.message(`  Providers: ${providerNames}`);
		p.log.message(`  Scope: ${installGlobally ? "Global" : "Project"}`);

		// Show unsupported combos
		const cmdProviders = getProvidersSupporting("commands");
		const unsupportedCmd = selectedProviders.filter((p) => !cmdProviders.includes(p));
		if (commands.length > 0 && unsupportedCmd.length > 0) {
			p.log.info(
				pc.dim(
					`  [i] Commands skipped for: ${unsupportedCmd.map((p) => providers[p].displayName).join(", ")} (unsupported)`,
				),
			);
		}
		console.log();

		// Phase 5: Confirm and install
		if (!options.yes) {
			const totalItems =
				agents.length + commands.length + skills.length + (configItem ? 1 : 0) + ruleItems.length;
			const confirmed = await p.confirm({
				message: `Migrate ${totalItems} item(s) to ${selectedProviders.length} provider(s)?`,
			});
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Migrate cancelled");
				return;
			}
		}

		const installSpinner = p.spinner();
		installSpinner.start("Migrating...");

		const allResults: PortableInstallResult[] = [];
		const installOpts = { global: installGlobally };

		// Install agents
		if (agents.length > 0) {
			const agentProviders = selectedProviders.filter((p) =>
				getProvidersSupporting("agents").includes(p),
			);
			if (agentProviders.length > 0) {
				const results = await installPortableItems(agents, agentProviders, "agent", installOpts);
				allResults.push(...results);
			}
		}

		// Install commands (only to providers that support them)
		if (commands.length > 0) {
			const cmdProviders = selectedProviders.filter((p) =>
				getProvidersSupporting("commands").includes(p),
			);
			if (cmdProviders.length > 0) {
				const results = await installPortableItems(commands, cmdProviders, "command", installOpts);
				allResults.push(...results);
			}
		}

		// Install skills (preserve directory structure)
		if (skills.length > 0) {
			const skillProviders = selectedProviders.filter((p) =>
				getProvidersSupporting("skills").includes(p),
			);
			if (skillProviders.length > 0) {
				const results = await installSkillDirectories(skills, skillProviders, installOpts);
				allResults.push(...results);
			}
		}

		// Install config (single file per provider)
		if (configItem) {
			const cfgProviders = selectedProviders.filter((p) =>
				getProvidersSupporting("config").includes(p),
			);
			if (cfgProviders.length > 0) {
				const results = await installPortableItems(
					[configItem],
					cfgProviders,
					"config",
					installOpts,
				);
				allResults.push(...results);
			}
		}

		// Install rules (per-file or merge per provider)
		if (ruleItems.length > 0) {
			const ruleProviders = selectedProviders.filter((p) =>
				getProvidersSupporting("rules").includes(p),
			);
			if (ruleProviders.length > 0) {
				const results = await installPortableItems(ruleItems, ruleProviders, "rules", installOpts);
				allResults.push(...results);
			}
		}

		installSpinner.stop("Migrate complete");

		// Display results
		displayResults(allResults);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		p.outro(pc.red("Migrate failed"));
		process.exit(1);
	}
}

/**
 * Display install results summary
 */
function displayResults(results: PortableInstallResult[]): void {
	console.log();

	const successful = results.filter((r) => r.success && !r.skipped);
	const skipped = results.filter((r) => r.skipped);
	const failed = results.filter((r) => !r.success);

	if (successful.length > 0) {
		for (const r of successful) {
			p.log.success(`${pc.green("[OK]")} ${r.providerDisplayName}`);
			if (r.warnings) {
				for (const w of r.warnings) {
					p.log.warn(`  ${pc.yellow("[!]")} ${w}`);
				}
			}
		}
	}

	if (skipped.length > 0) {
		for (const r of skipped) {
			p.log.info(
				`${pc.yellow("[i]")} ${r.providerDisplayName}: ${pc.dim(r.skipReason || "Skipped")}`,
			);
		}
	}

	if (failed.length > 0) {
		for (const r of failed) {
			p.log.error(`${pc.red("[X]")} ${r.providerDisplayName}: ${pc.dim(r.error || "Failed")}`);
		}
	}

	console.log();
	const parts = [];
	if (successful.length > 0) parts.push(`${successful.length} installed`);
	if (skipped.length > 0) parts.push(`${skipped.length} skipped`);
	if (failed.length > 0) parts.push(`${failed.length} failed`);

	if (parts.length === 0) {
		p.outro(pc.yellow("No installations performed"));
	} else if (failed.length > 0 && successful.length === 0) {
		p.outro(pc.red("Migrate failed"));
		process.exit(1);
	} else {
		p.outro(pc.green(`Done! ${parts.join(", ")}`));
	}
}
