import * as clack from "@clack/prompts";
import type { DependencyStatus } from "../types.js";
import { getClaudeKitSetup } from "../utils/claudekit-scanner.js";
import { checkAllDependencies } from "../utils/dependency-checker.js";
import {
	detectOS,
	getInstallerMethods,
	getManualInstructions,
	installDependency,
} from "../utils/dependency-installer.js";
import { logger } from "../utils/logger.js";

/**
 * Check if we're running in a non-interactive environment (CI, no TTY, etc.)
 */
function isNonInteractive(): boolean {
	return (
		!process.stdin.isTTY || process.env.CI === "true" || process.env.NON_INTERACTIVE === "true"
	);
}

export async function doctorCommand(): Promise<void> {
	clack.intro("🩺 ClaudeKit Setup Overview");

	try {
		// Check system dependencies
		const dependencies = await checkAllDependencies();
		const setup = await getClaudeKitSetup();

		// Display System Dependencies
		logger.info("");
		logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		logger.info("System Dependencies");
		logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		logger.info("");

		const missingDeps: DependencyStatus[] = [];

		for (const dep of dependencies) {
			if (dep.installed && dep.meetsRequirements) {
				logger.info(`✅ ${dep.name.charAt(0).toUpperCase() + dep.name.slice(1)}`);
				if (dep.version) {
					logger.info(`   Version: ${dep.version}`);
				}
				if (dep.path) {
					logger.info(`   Location: ${dep.path}`);
				}
			} else if (dep.installed && !dep.meetsRequirements) {
				logger.info(`⚠️  ${dep.name.charAt(0).toUpperCase() + dep.name.slice(1)}`);
				if (dep.version) {
					logger.info(`   Version: ${dep.version} (outdated)`);
				}
				if (dep.minVersion) {
					logger.info(`   Required: ${dep.minVersion} or higher`);
				}
				if (dep.message) {
					logger.info(`   ${dep.message}`);
				}
				missingDeps.push(dep);
			} else {
				logger.info(`❌ ${dep.name.charAt(0).toUpperCase() + dep.name.slice(1)}`);
				logger.info("   Status: Not installed");
				if (dep.minVersion) {
					logger.info(`   Required: ${dep.minVersion} or higher`);
				}
				missingDeps.push(dep);
			}
			logger.info("");
		}

		logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

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

		// Offer to install missing dependencies
		if (missingDeps.length > 0) {
			logger.info("");
			logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
			logger.info("Missing Dependencies Detected");
			logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
			logger.info("");

			// In non-interactive mode (CI, no TTY), skip prompts and show manual instructions
			const nonInteractive = isNonInteractive();
			let shouldInstall = false;

			if (nonInteractive) {
				logger.info("Running in non-interactive mode. Skipping automatic installation.");
				logger.info("");
			} else {
				const response = await clack.confirm({
					message: "Would you like to install missing dependencies automatically?",
					initialValue: true,
				});

				if (clack.isCancel(response)) {
					shouldInstall = false;
				} else {
					shouldInstall = response;
				}
			}

			if (!shouldInstall) {
				logger.info("");
				logger.info("Manual Installation Instructions:");
				logger.info("");

				const osInfo = await detectOS();
				for (const dep of missingDeps) {
					// Skip pip and npm as they come with python and nodejs
					if (dep.name === "pip" || dep.name === "npm") continue;

					logger.info(`${dep.name.charAt(0).toUpperCase() + dep.name.slice(1)}:`);
					const instructions = getManualInstructions(dep.name as any, osInfo);
					for (const instruction of instructions) {
						logger.info(`  ${instruction}`);
					}
					logger.info("");
				}
			} else {
				// Install dependencies
				logger.info("");
				const osInfo = await detectOS();

				for (const dep of missingDeps) {
					// Skip pip and npm as they come with python and nodejs
					if (dep.name === "pip" || dep.name === "npm") continue;

					const methods = getInstallerMethods(dep.name as any, osInfo);
					if (methods.length === 0) {
						logger.warning(`No automatic installation method available for ${dep.name}`);
						logger.info("Manual installation required:");
						const instructions = getManualInstructions(dep.name as any, osInfo);
						for (const instruction of instructions) {
							logger.info(`  ${instruction}`);
						}
						logger.info("");
						continue;
					}

					const spinner = clack.spinner();
					spinner.start(`Installing ${dep.name}...`);

					const result = await installDependency(dep.name as any);

					if (result.success) {
						spinner.stop(`✅ ${dep.name} installed successfully`);
						if (result.installedVersion) {
							logger.info(`   Version: ${result.installedVersion}`);
						}
					} else {
						spinner.stop(`❌ Failed to install ${dep.name}`);
						logger.error(`   ${result.message}`);
						logger.info("");
						logger.info("Manual installation required:");
						const instructions = getManualInstructions(dep.name as any, osInfo);
						for (const instruction of instructions) {
							logger.info(`  ${instruction}`);
						}
					}
					logger.info("");
				}

				logger.info("✅ Dependency installation complete!");
			}
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
