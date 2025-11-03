import * as clack from "@clack/prompts";
import { getClaudeKitSetup } from "../utils/claudekit-scanner.js";
import { logger } from "../utils/logger.js";

export async function doctorCommand(): Promise<void> {
	clack.intro("🩺 ClaudeKit Setup Overview");

	try {
		const setup = await getClaudeKitSetup();

		// Display Global Setup
		logger.info("");
		logger.info("CK Global Setup");
		if (setup.global.path) {
			logger.info(`Location: ${setup.global.path}`);

			if (setup.global.metadata) {
				logger.info(`Version: ${setup.global.metadata.version}`);
				logger.info(`Name: ${setup.global.metadata.name}`);
			} else {
				logger.info("Version: Not installed globally");
			}

			// Display component counts
			const { agents, commands, workflows, skills } = setup.global.components;
			logger.info(
				`Components: ${agents} agents, ${commands} commands, ${workflows} workflows, ${skills} skills`,
			);
		} else {
			logger.info("Status: No global installation found");
			logger.info("Install globally with: ck update --global");
		}

		// Display Project Setup
		logger.info("");
		logger.info("CK Project Setup");
		if (setup.project.path) {
			logger.info(`Location: ${setup.project.path}`);

			if (setup.project.metadata) {
				logger.info(`Version: ${setup.project.metadata.version}`);
				logger.info(`Name: ${setup.project.metadata.name}`);
			} else {
				logger.info("Version: Unknown (no metadata.json found)");
			}

			// Display component counts
			const { agents, commands, workflows, skills } = setup.project.components;
			logger.info(
				`Components: ${agents} agents, ${commands} commands, ${workflows} workflows, ${skills} skills`,
			);
		} else {
			logger.info("Status: Not in a ClaudeKit project");
			logger.info("Create a project with: ck new");
		}

		// Display Summary
		logger.info("");
		logger.info("Summary:");

		if (setup.global.path && setup.project.path) {
			logger.info("✅ Both global and project setups available");
		} else if (setup.global.path) {
			logger.info("✅ Global setup available (no project detected)");
		} else if (setup.project.path) {
			logger.info("✅ Project setup available (no global installation)");
		} else {
			logger.info("❌ No ClaudeKit setup found");
			logger.info("Get started with: ck new --kit engineer --global");
		}

		// Display component summary
		const totalAgents = setup.global.components.agents + setup.project.components.agents;
		const totalCommands = setup.global.components.commands + setup.project.components.commands;
		const totalWorkflows = setup.global.components.workflows + setup.project.components.workflows;
		const totalSkills = setup.global.components.skills + setup.project.components.skills;

		if (totalAgents > 0 || totalCommands > 0 || totalWorkflows > 0 || totalSkills > 0) {
			logger.info("");
			logger.info("Total Available Components:");
			logger.info(`🤖 Agents: ${totalAgents}`);
			logger.info(`⚡ Commands: ${totalCommands}`);
			logger.info(`🔄 Workflows: ${totalWorkflows}`);
			logger.info(`🛠️  Skills: ${totalSkills}`);
		}

		// Display helpful tips
		logger.info("");
		logger.info("Helpful Commands:");
		if (setup.global.path) {
			logger.info("• Update global installation: ck update --global");
		} else {
			logger.info("• Install globally: ck update --global");
		}

		if (setup.project.path) {
			logger.info("• Update project: ck update");
		} else {
			logger.info("• Create new project: ck new");
		}

		logger.info("• Troubleshoot issues: ck diagnose");
		logger.info("• Check versions: ck versions");
	} catch (error) {
		logger.error("Failed to analyze ClaudeKit setup");
		if (error instanceof Error) {
			logger.error(error.message);
		}
		process.exit(1);
	}
}
