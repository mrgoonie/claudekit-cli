/**
 * Post-installation phase
 * Handles CLAUDE.md copy, skills installation, Gemini MCP, and setup wizard
 */

import { join } from "node:path";
import { promptSetupWizardIfNeeded } from "@/domains/installation/setup-wizard.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { copy, pathExists } from "fs-extra";
import type { InitContext } from "../types.js";

/**
 * Handle post-installation tasks
 */
export async function handlePostInstall(ctx: InitContext): Promise<InitContext> {
	if (ctx.cancelled || !ctx.extractDir || !ctx.resolvedDir || !ctx.claudeDir) {
		return ctx;
	}

	// In global mode, copy CLAUDE.md from repository root
	if (ctx.options.global) {
		const claudeMdSource = join(ctx.extractDir, "CLAUDE.md");
		const claudeMdDest = join(ctx.resolvedDir, "CLAUDE.md");
		if (await pathExists(claudeMdSource)) {
			if (!(await pathExists(claudeMdDest))) {
				await copy(claudeMdSource, claudeMdDest);
				logger.success("Copied CLAUDE.md to global directory");
			} else {
				logger.debug("CLAUDE.md already exists in global directory (preserved)");
			}
		}
	}

	// Handle skills installation
	let installSkills = ctx.options.installSkills;

	if (!ctx.isNonInteractive && !installSkills) {
		installSkills = await ctx.prompts.promptSkillsInstallation();
	}

	if (installSkills) {
		const { handleSkillsInstallation } = await import(
			"@/services/package-installer/package-installer.js"
		);
		const skillsDir = PathResolver.buildSkillsPath(ctx.resolvedDir, ctx.options.global);
		// Pass skipConfirm when in non-interactive mode, and withSudo if user requested it
		await handleSkillsInstallation(skillsDir, {
			skipConfirm: ctx.isNonInteractive,
			withSudo: ctx.options.withSudo,
		});
	}

	// Auto-detect Gemini CLI and offer MCP integration setup
	if (!ctx.isNonInteractive) {
		const { isGeminiInstalled } = await import("@/services/package-installer/package-installer.js");
		const { checkExistingGeminiConfig, findMcpConfigPath, processGeminiMcpLinking } = await import(
			"@/services/package-installer/gemini-mcp-linker.js"
		);

		const geminiInstalled = await isGeminiInstalled();
		const existingConfig = checkExistingGeminiConfig(ctx.resolvedDir, ctx.options.global);
		const mcpConfigPath = findMcpConfigPath(ctx.resolvedDir);
		const mcpConfigExists = mcpConfigPath !== null;

		if (geminiInstalled && !existingConfig.exists && mcpConfigExists) {
			const geminiPath = ctx.options.global ? "~/.gemini/settings.json" : ".gemini/settings.json";
			const mcpPath = ctx.options.global ? "~/.claude/.mcp.json" : ".mcp.json";
			const promptMessage = [
				"Gemini CLI detected. Set up MCP integration?",
				`  → Creates ${geminiPath} symlink to ${mcpPath}`,
				"  → Gemini CLI will share MCP servers with Claude Code",
			].join("\n");

			const shouldSetupGemini = await ctx.prompts.confirm(promptMessage);
			if (shouldSetupGemini) {
				await processGeminiMcpLinking(ctx.resolvedDir, {
					isGlobal: ctx.options.global,
				});
			}
		}
	}

	// Run setup wizard if required keys are missing from .env
	if (!ctx.options.skipSetup) {
		await promptSetupWizardIfNeeded({
			envPath: join(ctx.claudeDir, ".env"),
			claudeDir: ctx.claudeDir,
			isGlobal: ctx.options.global,
			isNonInteractive: ctx.isNonInteractive,
			prompts: ctx.prompts,
		});
	}

	return {
		...ctx,
		installSkills,
	};
}
