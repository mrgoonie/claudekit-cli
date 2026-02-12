/**
 * Port command — one-shot migration of all agents, commands, skills, config,
 * and rules to target providers. Thin orchestration layer over portable infrastructure.
 */
import { existsSync } from "node:fs";
import { cp, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import matter from "gray-matter";
import pc from "picocolors";
import { logger } from "../../shared/logger.js";
import { discoverAgents, getAgentSourcePath } from "../agents/agents-discovery.js";
import { discoverCommands, getCommandSourcePath } from "../commands/commands-discovery.js";
import { discoverConfig, discoverRules } from "../portable/config-discovery.js";
import { installPortableItems } from "../portable/portable-installer.js";
import { addPortableInstallation } from "../portable/portable-registry.js";
import {
	detectInstalledProviders,
	getProvidersSupporting,
	providers,
} from "../portable/provider-registry.js";
import type { PortableInstallResult, PortableItem, ProviderType } from "../portable/types.js";
import { discoverSkills, getSkillSourcePath } from "../skills/skills-discovery.js";
import type { SkillInfo } from "../skills/types.js";

/** Options for ck port */
interface PortOptions {
	agent?: string[];
	global?: boolean;
	yes?: boolean;
	all?: boolean;
	config?: boolean;
	rules?: boolean;
	source?: string;
}

/**
 * Convert SkillInfo[] to PortableItem[] for the portable installer
 */
async function skillsToPortable(skills: SkillInfo[]): Promise<PortableItem[]> {
	const items: PortableItem[] = [];
	for (const skill of skills) {
		try {
			const skillMdPath = join(skill.path, "SKILL.md");
			const content = await readFile(skillMdPath, "utf-8");
			const { data, content: body } = matter(content);
			items.push({
				name: skill.name,
				displayName: skill.displayName,
				description: skill.description,
				type: "skill",
				sourcePath: skill.path,
				frontmatter: data,
				body,
			});
		} catch {
			// Skip skills that can't be read
		}
	}
	return items;
}

/**
 * Install skill directories preserving full structure (scripts, assets, references/)
 */
async function installSkillDirectories(
	skills: SkillInfo[],
	targetProviders: ProviderType[],
	options: { global: boolean },
): Promise<PortableInstallResult[]> {
	const results: PortableInstallResult[] = [];

	for (const provider of targetProviders) {
		const config = providers[provider];
		const skillConfig = config.skills;

		if (!skillConfig) {
			results.push({
				provider,
				providerDisplayName: config.displayName,
				success: false,
				path: "",
				error: `${config.displayName} does not support skills`,
			});
			continue;
		}

		const basePath = options.global ? skillConfig.globalPath : skillConfig.projectPath;
		if (!basePath) {
			results.push({
				provider,
				providerDisplayName: config.displayName,
				success: false,
				path: "",
				error: `${config.displayName} does not support ${options.global ? "global" : "project"}-level skills`,
			});
			continue;
		}

		// Install each skill directory
		for (const skill of skills) {
			const targetDir = join(basePath, skill.name);

			// Skip if source and destination are identical
			if (resolve(skill.path) === resolve(targetDir)) {
				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: true,
					path: targetDir,
					skipped: true,
					skipReason: "Already at source location",
				});
				continue;
			}

			try {
				// Ensure parent directory exists
				if (!existsSync(basePath)) {
					await mkdir(basePath, { recursive: true });
				}

				// Copy entire skill directory recursively
				await cp(skill.path, targetDir, { recursive: true, force: true });

				// Register in portable registry
				await addPortableInstallation(
					skill.name,
					"skill",
					provider,
					options.global,
					targetDir,
					skill.path,
				);

				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: true,
					path: targetDir,
				});
			} catch (error) {
				results.push({
					provider,
					providerDisplayName: config.displayName,
					success: false,
					path: targetDir,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}
	}

	return results;
}

/**
 * Main port command handler
 */
export async function portCommand(options: PortOptions): Promise<void> {
	console.log();
	p.intro(pc.bgMagenta(pc.black(" ck port ")));

	try {
		// Determine what to port based on flags
		// CAC: --config sets config=true, --no-config sets config=false, omitted = undefined
		const configExplicitlyDisabled = options.config === false;
		const rulesExplicitlyDisabled = options.rules === false;
		const configOnly = options.config === true && options.rules !== true;
		const rulesOnly = options.rules === true && options.config !== true;
		const configAndRulesOnly = options.config === true && options.rules === true;
		const portAgents = !configOnly && !rulesOnly && !configAndRulesOnly;
		const portCommands = !configOnly && !rulesOnly && !configAndRulesOnly;
		const portSkills = !configOnly && !rulesOnly && !configAndRulesOnly;
		const portConfig =
			!configExplicitlyDisabled &&
			(options.config === true || (!configOnly && !rulesOnly) || configAndRulesOnly);
		const portRules =
			!rulesExplicitlyDisabled &&
			(options.rules === true || (!configOnly && !rulesOnly) || configAndRulesOnly);

		// Phase 1: Discover all portable items
		const spinner = p.spinner();
		spinner.start("Discovering portable items...");

		const agentSource = portAgents ? getAgentSourcePath() : null;
		const commandSource = portCommands ? getCommandSourcePath() : null;
		const skillSource = portSkills ? getSkillSourcePath() : null;

		const agents = agentSource ? await discoverAgents(agentSource) : [];
		const commands = commandSource ? await discoverCommands(commandSource) : [];
		const rawSkills = skillSource ? await discoverSkills(skillSource) : [];
		const skills = await skillsToPortable(rawSkills);
		const configItem = portConfig ? await discoverConfig(options.source) : null;
		const ruleItems = portRules ? await discoverRules() : [];

		spinner.stop("Discovery complete");

		const hasItems =
			agents.length > 0 ||
			commands.length > 0 ||
			skills.length > 0 ||
			configItem !== null ||
			ruleItems.length > 0;

		if (!hasItems) {
			p.log.error("Nothing to port.");
			p.log.info(
				pc.dim(
					"Check ~/.claude/agents/, ~/.claude/commands/, ~/.claude/skills/, and ~/.claude/CLAUDE.md",
				),
			);
			p.outro(pc.red("Nothing to port"));
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
			p.log.info(`Porting to all ${selectedProviders.length} providers`);
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
				p.log.info("No providers detected, porting to all");
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
					message: "Select providers to port to",
					options: Array.from(allProviders).map((key) => ({
						value: key,
						label: providers[key].displayName,
					})),
					required: true,
				});
				if (p.isCancel(selected)) {
					p.cancel("Port cancelled");
					return;
				}
				selectedProviders = selected as ProviderType[];
			}
		} else if (detectedProviders.length === 1 || options.yes) {
			selectedProviders = detectedProviders;
			p.log.info(
				`Porting to: ${detectedProviders.map((a) => pc.cyan(providers[a].displayName)).join(", ")}`,
			);
		} else {
			const selected = await p.multiselect({
				message: "Select providers to port to",
				options: detectedProviders.map((a) => ({
					value: a,
					label: providers[a].displayName,
				})),
				required: true,
				initialValues: detectedProviders,
			});
			if (p.isCancel(selected)) {
				p.cancel("Port cancelled");
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
				p.cancel("Port cancelled");
				return;
			}
			installGlobally = scope as boolean;
		}

		// Phase 4: Summary
		console.log();
		p.log.step(pc.bold("Port Summary"));
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
				message: `Port ${totalItems} item(s) to ${selectedProviders.length} provider(s)?`,
			});
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Port cancelled");
				return;
			}
		}

		const installSpinner = p.spinner();
		installSpinner.start("Porting...");

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
		if (rawSkills.length > 0) {
			const skillProviders = selectedProviders.filter((p) =>
				getProvidersSupporting("skills").includes(p),
			);
			if (skillProviders.length > 0) {
				const results = await installSkillDirectories(rawSkills, skillProviders, installOpts);
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

		installSpinner.stop("Port complete");

		// Display results
		displayResults(allResults);
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		p.outro(pc.red("Port failed"));
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
		p.outro(pc.red("Port failed"));
		process.exit(1);
	} else {
		p.outro(pc.green(`Done! ${parts.join(", ")}`));
	}
}
