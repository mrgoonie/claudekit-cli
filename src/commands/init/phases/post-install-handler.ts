/**
 * Post-installation phase
 * Handles CLAUDE.md copy, skills installation, Gemini MCP, setup wizard, and project registration
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

	// CC version gate — check plugin support before attempting install
	let pluginSupported = false;
	try {
		const { requireCCPluginSupport } = await import("@/services/cc-version-checker.js");
		await requireCCPluginSupport();
		pluginSupported = true;
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Unknown error";
		logger.info(`Plugin install skipped: ${msg}`);
		if (msg.includes("does not support plugins")) {
			logger.info("Upgrade: brew upgrade claude-code (or npm i -g @anthropic-ai/claude-code)");
		}
	}

	// Plugin registration is always global (CC plugins are inherently user-wide).
	// Even a local `ck init` modifies ~/.claudekit/marketplace/ and the global
	// CC plugin registry. This is intentional — plugins aren't project-scoped.

	// Register CK plugin with Claude Code for ck:* skill namespace
	let pluginVerified = false;
	if (pluginSupported) {
		try {
			const { handlePluginInstall } = await import("@/services/plugin-installer.js");
			const pluginResult = await handlePluginInstall(ctx.extractDir);
			pluginVerified = pluginResult.verified;
			if (pluginResult.error) {
				logger.debug(`Plugin install issue: ${pluginResult.error}`);
			}
		} catch (error) {
			// Non-fatal: plugin install is optional enhancement
			logger.debug(
				`Plugin install skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Record plugin state in metadata for idempotent re-runs
		if (ctx.claudeDir && ctx.kitType) {
			try {
				const { updateKitPluginState } = await import("@/domains/migration/metadata-migration.js");
				await updateKitPluginState(ctx.claudeDir, ctx.kitType, {
					pluginInstalled: pluginVerified,
					pluginInstalledAt: new Date().toISOString(),
					pluginVersion: ctx.selectedVersion || "",
				});
			} catch {
				// Non-fatal: metadata tracking is best-effort
			}
		}
	}

	// Process deferred skill deletions (from Phase 7 merge-handler)
	// Only delete skills after plugin verification + user skill migration
	if (ctx.deferredDeletions?.length && ctx.claudeDir) {
		try {
			const { migrateUserSkills } = await import("@/services/skill-migration-merger.js");
			const migration = await migrateUserSkills(ctx.claudeDir, pluginVerified);

			if (pluginVerified) {
				// Filter out user-preserved skills from deferred deletions
				const preservedDirs = new Set(migration.preserved);
				const safeDeletions = ctx.deferredDeletions.filter((d) => {
					// d is like "skills/<name>/**" — extract "skills/<name>"
					const dirPath = d.replace(/\/\*\*$/, "").replace(/\\\*\*$/, "");
					return !preservedDirs.has(dirPath);
				});

				if (safeDeletions.length > 0) {
					const { handleDeletions } = await import("@/domains/installation/deletion-handler.js");
					const deferredResult = await handleDeletions(
						{ deletions: safeDeletions } as import("@/types").ClaudeKitMetadata,
						ctx.claudeDir,
					);
					if (deferredResult.deletedPaths.length > 0) {
						logger.info(
							`Removed ${deferredResult.deletedPaths.length} old skill file(s) (replaced by plugin)`,
						);
					}
				}
			} else {
				logger.info("Plugin not verified — keeping existing skills as fallback");
			}
		} catch (error) {
			logger.debug(`Deferred skill deletion failed: ${error}`);
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
		pluginSupported,
	};
}
