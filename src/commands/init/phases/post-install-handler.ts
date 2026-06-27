/**
 * Post-installation phase
 * Handles CLAUDE.md copy, skills installation, agy MCP, setup wizard, and project registration
 */

import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/projects-registry.js";
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
			if (ctx.options.fresh || !(await pathExists(claudeMdDest))) {
				await copy(claudeMdSource, claudeMdDest);
				logger.success(
					ctx.options.fresh
						? "Replaced CLAUDE.md in global directory (fresh install)"
						: "Copied CLAUDE.md to global directory",
				);
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

	// Auto-detect Antigravity (agy) CLI and offer MCP integration setup
	if (!ctx.isNonInteractive) {
		const { isAgyInstalled } = await import("@/services/package-installer/package-installer.js");
		const { checkExistingAgyConfig, findMcpConfigPath, processAgyMcpLinking } = await import(
			"@/services/package-installer/agy-mcp-linker.js"
		);

		const agyInstalled = await isAgyInstalled();
		const existingConfig = checkExistingAgyConfig(ctx.resolvedDir, ctx.options.global);
		const mcpConfigPath = findMcpConfigPath(ctx.resolvedDir);
		const mcpConfigExists = mcpConfigPath !== null;

		if (agyInstalled && !existingConfig.exists && mcpConfigExists) {
			const agyPath = ctx.options.global
				? "~/.gemini/config/mcp_config.json"
				: ".agents/mcp_config.json";
			const mcpPath = ctx.options.global ? "~/.claude/.mcp.json" : ".mcp.json";
			const promptMessage = [
				"Antigravity CLI (agy) detected. Set up MCP integration?",
				`  → Creates ${agyPath} symlink to ${mcpPath}`,
				"  → agy will share MCP servers with Claude Code",
			].join("\n");

			const shouldSetupAgy = await ctx.prompts.confirm(promptMessage);
			if (shouldSetupAgy) {
				await processAgyMcpLinking(ctx.resolvedDir, {
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

	// Auto-register project in registry (for dashboard quick-switching)
	// Only register local projects, not global installs
	if (!ctx.options.global && ctx.resolvedDir) {
		try {
			await ProjectsRegistryManager.addProject(ctx.resolvedDir);
			logger.debug(`Project registered: ${ctx.resolvedDir}`);
		} catch (error) {
			// Non-fatal: don't fail init if registration fails
			logger.debug(
				`Project auto-registration skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	return {
		...ctx,
		installSkills,
	};
}
