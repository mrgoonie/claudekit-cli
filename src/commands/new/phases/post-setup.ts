/**
 * Post Setup Phase
 *
 * Handles optional package installations, project registration, setup wizard, and final success message.
 */

import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/projects-registry.js";
import { promptSetupWizardIfNeeded } from "@/domains/installation/setup-wizard.js";
import type { PromptsManager } from "@/domains/ui/prompts.js";
import { processPackageInstallations } from "@/services/package-installer/package-installer.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import type { NewCommandOptions } from "@/types";
import type { NewContext } from "../types.js";

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
	// Note: the `--gemini` flag now drives the Antigravity (agy) CLI install, since
	// Google retired the standalone gemini CLI. The flag name is kept for compatibility.
	let installOpenCode = validOptions.opencode;
	let installAgy = validOptions.gemini;
	let installSkills = validOptions.installSkills;

	if (!isNonInteractive && !installOpenCode && !installAgy && !installSkills) {
		// Interactive mode: prompt for package installations
		const packageChoices = await prompts.promptPackageInstallations();
		installOpenCode = packageChoices.installOpenCode;
		installAgy = packageChoices.installAgy;

		// Prompt for skills installation
		installSkills = await prompts.promptSkillsInstallation();
	}

	// Install packages if requested
	if (installOpenCode || installAgy) {
		logger.info("Installing optional packages...");
		try {
			const installationResults = await processPackageInstallations(
				installOpenCode,
				installAgy,
				resolvedDir, // Pass project dir for agy MCP linking setup
			);
			prompts.showPackageInstallationResults(installationResults);
		} catch (error) {
			// Don't let package installation failures crash the entire project creation
			logger.warning(
				`Package installation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			logger.info(
				"You can install these packages manually later from each tool's official install guide.",
			);
		}
	}

	// Install skills dependencies if requested
	if (installSkills) {
		const { handleSkillsInstallation } = await import(
			"../../../services/package-installer/package-installer.js"
		);
		const skillsDir = PathResolver.buildSkillsPath(resolvedDir, false); // new command is never global
		// Pass skipConfirm when in non-interactive mode, and withSudo if user requested it
		await handleSkillsInstallation(skillsDir, {
			skipConfirm: isNonInteractive,
			withSudo: validOptions.withSudo,
		});
	}

	// Run setup wizard if required keys are missing from .env
	const claudeDir = join(resolvedDir, ".claude");
	await promptSetupWizardIfNeeded({
		envPath: join(claudeDir, ".env"),
		claudeDir,
		isGlobal: false, // new command is never global
		isNonInteractive,
		prompts,
	});

	// Auto-register project in registry (for dashboard quick-switching)
	try {
		await ProjectsRegistryManager.addProject(resolvedDir);
		logger.debug(`Project registered: ${resolvedDir}`);
	} catch (error) {
		// Non-fatal: don't fail if registration fails
		logger.debug(
			`Project auto-registration skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Context handler for post-setup phase
 */
export async function handlePostSetup(ctx: NewContext): Promise<NewContext> {
	if (!ctx.resolvedDir) {
		return { ...ctx, cancelled: true };
	}

	await postSetup(ctx.resolvedDir, ctx.options, ctx.isNonInteractive, ctx.prompts);
	return ctx;
}
