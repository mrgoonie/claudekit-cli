/**
 * Post Setup Phase
 *
 * Handles optional package installations and final success message.
 */

import type { PromptsManager } from "@/domains/ui/prompts.js";
import { processPackageInstallations } from "@/services/package-installer/package-installer.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { NewCommandOptions } from "@/types";

/**
 * Handle post-creation tasks (package installations, skills)
 */
export async function postSetup(
	resolvedDir: string,
	validOptions: NewCommandOptions,
	isNonInteractive: boolean,
	prompts: PromptsManager,
): Promise<void> {
	// Handle optional package installations
	let installOpenCode = validOptions.opencode;
	let installGemini = validOptions.gemini;
	let installSkills = validOptions.installSkills;

	if (!isNonInteractive && !installOpenCode && !installGemini && !installSkills) {
		// Interactive mode: prompt for package installations
		const packageChoices = await prompts.promptPackageInstallations();
		installOpenCode = packageChoices.installOpenCode;
		installGemini = packageChoices.installGemini;

		// Prompt for skills installation
		installSkills = await prompts.promptSkillsInstallation();
	}

	// Install packages if requested
	if (installOpenCode || installGemini) {
		logger.info("Installing optional packages...");
		try {
			const installationResults = await processPackageInstallations(
				installOpenCode,
				installGemini,
				resolvedDir, // Pass project dir for Gemini MCP symlink setup
			);
			prompts.showPackageInstallationResults(installationResults);
		} catch (error) {
			// Don't let package installation failures crash the entire project creation
			logger.warning(
				`Package installation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			logger.info("You can install these packages manually later using npm install -g <package>");
		}
	}

	// Install skills dependencies if requested
	if (installSkills) {
		const { handleSkillsInstallation } = await import(
			"../../../services/package-installer/package-installer.js"
		);
		const skillsDir = PathResolver.buildSkillsPath(resolvedDir, false); // new command is never global
		await handleSkillsInstallation(skillsDir);
	}
}
