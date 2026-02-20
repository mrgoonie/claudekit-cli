/**
 * Post-installation phase
 * Handles CLAUDE.md copy, skills installation, Gemini MCP, setup wizard, and project registration
 */

import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/projects-registry.js";
import { promptSetupWizardIfNeeded } from "@/domains/installation/setup-wizard.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { copy, pathExists, readFile } from "fs-extra";
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
		await handleGlobalClaudeMd(ctx);
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

	// Register CK plugin with Claude Code for ck:* skill namespace
	if (ctx.extractDir) {
		try {
			const { handlePluginInstall } = await import("@/services/plugin-installer.js");
			await handlePluginInstall(ctx.extractDir);
		} catch (error) {
			// Non-fatal: plugin install is optional enhancement
			logger.debug(
				`Plugin install skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
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

/** Normalize line endings for cross-platform content comparison */
function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, "\n");
}

/**
 * Handle CLAUDE.md copy/update for global installs.
 * - First install: copy directly
 * - --fresh / --force-overwrite: always replace
 * - Re-init (interactive): prompt if content differs
 * - Re-init (non-interactive): update silently if content differs
 */
export async function handleGlobalClaudeMd(ctx: InitContext): Promise<void> {
	if (!ctx.extractDir || !ctx.resolvedDir) return;

	const claudeMdSource = join(ctx.extractDir, "CLAUDE.md");
	const claudeMdDest = join(ctx.resolvedDir, "CLAUDE.md");

	if (!(await pathExists(claudeMdSource))) return;

	const destExists = await pathExists(claudeMdDest);

	if (!destExists) {
		await copy(claudeMdSource, claudeMdDest);
		logger.success("Copied CLAUDE.md to global directory");
		return;
	}

	if (ctx.options.fresh || ctx.options.forceOverwrite) {
		await copy(claudeMdSource, claudeMdDest);
		logger.success("Updated CLAUDE.md in global directory");
		return;
	}

	// Compare content (normalize line endings for cross-platform consistency)
	const [srcContent, destContent] = await Promise.all([
		readFile(claudeMdSource, "utf-8"),
		readFile(claudeMdDest, "utf-8"),
	]);

	if (normalizeLineEndings(srcContent) === normalizeLineEndings(destContent)) {
		logger.debug("CLAUDE.md already up to date");
		return;
	}

	// Content differs — prompt in interactive mode, warn in non-interactive
	if (!ctx.isNonInteractive) {
		const shouldOverwrite = await ctx.prompts.confirm(
			"CLAUDE.md has changed in the new version. Update it?\n  (Your customizations will be replaced)",
		);
		if (!shouldOverwrite) {
			logger.info("CLAUDE.md preserved (user chose to keep existing)");
			return;
		}
	} else {
		logger.warning("Updating CLAUDE.md (content differs from new version)");
	}

	await copy(claudeMdSource, claudeMdDest);
	logger.success("Updated CLAUDE.md (new version detected)");
}
