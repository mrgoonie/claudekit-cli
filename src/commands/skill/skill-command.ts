/**
 * Skill command - install ClaudeKit skills to other coding agents
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { logger } from "../../shared/logger.js";
import { agents } from "./agents.js";
import { discoverSkills, findSkillByName, getSkillSourcePath } from "./skill-discovery.js";
import { getInstallPreview, installSkillToAgents } from "./skill-installer.js";
import {
	type AgentType,
	type SkillCommandOptions,
	SkillCommandOptionsSchema,
	type SkillContext,
	type SkillInfo,
} from "./types.js";

/**
 * Detect which agents are installed on the system
 */
async function detectInstalledAgents(): Promise<AgentType[]> {
	const installed: AgentType[] = [];
	for (const [type, config] of Object.entries(agents)) {
		if (await config.detect()) {
			installed.push(type as AgentType);
		}
	}
	return installed;
}

/**
 * List available skills
 */
async function listSkills(): Promise<void> {
	const sourcePath = getSkillSourcePath();
	if (!sourcePath) {
		logger.error("No skills found. Install ClaudeKit Engineer first.");
		process.exit(1);
	}

	const skills = await discoverSkills(sourcePath);
	if (skills.length === 0) {
		logger.warning("No skills found in source directory.");
		return;
	}

	console.log();
	p.log.step(pc.bold("Available Skills"));
	console.log();

	for (const skill of skills) {
		console.log(`  ${pc.cyan(skill.name)}`);
		console.log(`    ${pc.dim(skill.description)}`);
	}

	console.log();
	console.log(pc.dim(`  ${skills.length} skill(s) available`));
	console.log(pc.dim(`  Source: ${sourcePath}`));
	console.log();
}

/**
 * Main skill command handler
 */
export async function skillCommand(options: SkillCommandOptions): Promise<void> {
	console.log();
	p.intro(pc.bgCyan(pc.black(" ck skill ")));

	try {
		// Validate options
		const validOptions = SkillCommandOptionsSchema.parse(options);

		// Handle list mode
		if (validOptions.list) {
			await listSkills();
			p.outro(pc.dim("Use --name <skill> to install a specific skill"));
			return;
		}

		// Check skill source exists
		const sourcePath = getSkillSourcePath();
		if (!sourcePath) {
			p.log.error("No skills found. Install ClaudeKit Engineer first.");
			p.outro(pc.red("Installation failed"));
			process.exit(1);
		}

		// Discover available skills
		const availableSkills = await discoverSkills(sourcePath);
		if (availableSkills.length === 0) {
			p.log.error("No valid skills found in source directory.");
			p.outro(pc.red("Installation failed"));
			process.exit(1);
		}

		// Build context
		const ctx: SkillContext = {
			options: validOptions,
			cancelled: false,
			selectedAgents: [],
			installGlobally: validOptions.global ?? false,
			availableSkills,
			detectedAgents: await detectInstalledAgents(),
		};

		// Phase 1: Select skill
		if (validOptions.name) {
			// Validate skill name is not empty/whitespace
			const trimmedName = validOptions.name.trim();
			if (!trimmedName) {
				p.log.error("Skill name cannot be empty");
				p.outro(pc.red("Installation failed"));
				process.exit(1);
			}

			const skill = await findSkillByName(trimmedName, sourcePath);
			if (!skill) {
				p.log.error(`Skill not found: ${trimmedName}`);
				p.log.info("Available skills:");
				for (const s of availableSkills) {
					p.log.message(`  - ${s.name}`);
				}
				p.outro(pc.red("Installation failed"));
				process.exit(1);
			}
			ctx.selectedSkill = skill;
			p.log.info(`Skill: ${pc.cyan(skill.name)}`);
			p.log.message(pc.dim(skill.description));
		} else if (availableSkills.length === 1) {
			ctx.selectedSkill = availableSkills[0];
			p.log.info(`Skill: ${pc.cyan(ctx.selectedSkill.name)}`);
		} else if (validOptions.yes) {
			p.log.error("--name required in non-interactive mode with multiple skills");
			process.exit(1);
		} else {
			// Interactive skill selection
			const skillChoices = availableSkills.map((s) => ({
				value: s,
				label: s.name,
				hint: s.description.length > 50 ? `${s.description.slice(0, 47)}...` : s.description,
			}));

			const selected = await p.select({
				message: "Select a skill to install",
				options: skillChoices,
			});

			if (p.isCancel(selected)) {
				p.cancel("Installation cancelled");
				return;
			}

			ctx.selectedSkill = selected as SkillInfo;
		}

		// Phase 2: Select agents
		const validAgentTypes = Object.keys(agents) as AgentType[];

		if (validOptions.agent && validOptions.agent.length > 0) {
			// Validate provided agents
			const invalidAgents = validOptions.agent.filter(
				(a) => !validAgentTypes.includes(a as AgentType),
			);
			if (invalidAgents.length > 0) {
				p.log.error(`Invalid agents: ${invalidAgents.join(", ")}`);
				p.log.info(`Valid agents: ${validAgentTypes.join(", ")}`);
				process.exit(1);
			}
			ctx.selectedAgents = validOptions.agent as AgentType[];
		} else if (validOptions.all) {
			// Install to all agents
			ctx.selectedAgents = validAgentTypes;
			p.log.info(`Installing to all ${validAgentTypes.length} agents`);
		} else if (ctx.detectedAgents.length === 0) {
			// No agents detected
			if (validOptions.yes) {
				ctx.selectedAgents = validAgentTypes;
				p.log.info("No agents detected, installing to all");
			} else {
				p.log.warn("No coding agents detected on your system.");

				const agentChoices = Object.entries(agents).map(([key, config]) => ({
					value: key as AgentType,
					label: config.displayName,
				}));

				const selected = await p.multiselect({
					message: "Select agents to install to",
					options: agentChoices,
					required: true,
				});

				if (p.isCancel(selected)) {
					p.cancel("Installation cancelled");
					return;
				}

				ctx.selectedAgents = selected as AgentType[];
			}
		} else if (ctx.detectedAgents.length === 1 || validOptions.yes) {
			ctx.selectedAgents = ctx.detectedAgents;
			p.log.info(
				`Installing to: ${ctx.detectedAgents.map((a) => pc.cyan(agents[a].displayName)).join(", ")}`,
			);
		} else {
			// Interactive agent selection
			const agentChoices = ctx.detectedAgents.map((a) => ({
				value: a,
				label: agents[a].displayName,
				hint: ctx.installGlobally ? agents[a].globalPath : agents[a].projectPath,
			}));

			const selected = await p.multiselect({
				message: "Select agents to install to",
				options: agentChoices,
				required: true,
				initialValues: ctx.detectedAgents,
			});

			if (p.isCancel(selected)) {
				p.cancel("Installation cancelled");
				return;
			}

			ctx.selectedAgents = selected as AgentType[];
		}

		// Phase 3: Select scope (global vs project)
		if (validOptions.global === undefined && !validOptions.yes) {
			const scope = await p.select({
				message: "Installation scope",
				options: [
					{
						value: false,
						label: "Project",
						hint: "Install in current directory (committed with project)",
					},
					{
						value: true,
						label: "Global",
						hint: "Install in home directory (available across projects)",
					},
				],
			});

			if (p.isCancel(scope)) {
				p.cancel("Installation cancelled");
				return;
			}

			ctx.installGlobally = scope as boolean;
		}

		// Ensure skill is selected (should always be true at this point)
		if (!ctx.selectedSkill) {
			p.log.error("No skill selected");
			process.exit(1);
		}
		const selectedSkill = ctx.selectedSkill;

		// Phase 4: Show installation summary
		console.log();
		p.log.step(pc.bold("Installation Summary"));

		const preview = getInstallPreview(selectedSkill, ctx.selectedAgents, {
			global: ctx.installGlobally,
		});
		for (const item of preview) {
			const status = item.exists ? pc.yellow(" (will overwrite)") : "";
			p.log.message(`  ${pc.dim("→")} ${item.displayName}: ${pc.dim(item.path)}${status}`);
		}
		console.log();

		// Phase 5: Confirm and install
		if (!validOptions.yes) {
			const confirmed = await p.confirm({ message: "Proceed with installation?" });
			if (p.isCancel(confirmed) || !confirmed) {
				p.cancel("Installation cancelled");
				return;
			}
		}

		const spinner = p.spinner();
		spinner.start("Installing skill...");

		const results = await installSkillToAgents(selectedSkill, ctx.selectedAgents, {
			global: ctx.installGlobally,
		});

		spinner.stop("Installation complete");

		// Show results
		console.log();
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		if (successful.length > 0) {
			p.log.success(pc.green(`Successfully installed to ${successful.length} agent(s)`));
			for (const r of successful) {
				p.log.message(`  ${pc.green("✓")} ${r.agentDisplayName}`);
				p.log.message(`    ${pc.dim(r.path)}`);
			}
		}

		if (failed.length > 0) {
			console.log();
			p.log.error(pc.red(`Failed to install to ${failed.length} agent(s)`));
			for (const r of failed) {
				p.log.message(`  ${pc.red("✗")} ${r.agentDisplayName}`);
				p.log.message(`    ${pc.dim(r.error)}`);
			}
		}

		console.log();
		if (successful.length === 0 && failed.length === 0) {
			p.outro(pc.yellow("No installations performed"));
		} else if (failed.length > 0 && successful.length === 0) {
			p.outro(pc.red("Installation failed"));
			process.exit(1);
		} else {
			p.outro(pc.green("Done!"));
		}
	} catch (error) {
		logger.error(error instanceof Error ? error.message : "Unknown error");
		p.outro(pc.red("Installation failed"));
		process.exit(1);
	}
}
