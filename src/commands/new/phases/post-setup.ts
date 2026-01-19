/**
 * Post Setup Phase
 *
 * Handles optional package installations, skills, and setup wizard.
 */

import { join } from "node:path";
import { checkRequiredKeysExist, runSetupWizard } from "@/domains/installation/setup-wizard.js";
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
		// Pass skipConfirm when in non-interactive mode, and withSudo if user requested it
		await handleSkillsInstallation(skillsDir, {
			skipConfirm: isNonInteractive,
			withSudo: validOptions.withSudo,
		});
	}

	// Run setup wizard if required keys are missing from .env
	if (!isNonInteractive) {
		const claudeDir = join(resolvedDir, ".claude");
		const envPath = join(claudeDir, ".env");
		const { allPresent, missing, envExists } = await checkRequiredKeysExist(envPath);

		if (!allPresent) {
			// Different prompt message based on whether .env exists
			const missingKeys = missing.map((m) => m.label).join(", ");
			const promptMessage = envExists
				? `Missing required: ${missingKeys}. Set up now?`
				: "Set up API keys now? (Gemini API key for ai-multimodal skill, optional webhooks)";

			const shouldSetup = await prompts.confirm(promptMessage);
			if (shouldSetup) {
				await runSetupWizard({
					targetDir: claudeDir,
					isGlobal: false, // new command is never global
				});
			} else {
				prompts.note(
					`Create ${envPath} manually or run 'ck init' again.\nRequired: GEMINI_API_KEY\nOptional: DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN`,
					"Configuration skipped",
				);
			}
		}
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
