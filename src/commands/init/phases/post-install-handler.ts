/**
 * Post-installation phase
 * Handles CLAUDE.md copy, skills installation, Gemini MCP, setup wizard, and project registration
 */

import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/projects-registry.js";
import { promptSetupWizardIfNeeded } from "@/domains/installation/setup-wizard.js";
import { CCPluginSupportError } from "@/services/cc-version-checker.js";
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
		if (error instanceof CCPluginSupportError) {
			logger.info(`Plugin install skipped: ${error.message}`);
			if (error.code === "cc_version_too_old") {
				logger.info("Upgrade: brew upgrade claude-code (or npm i -g @anthropic-ai/claude-code)");
			}
			if (error.code === "cc_not_found") {
				logger.info("Install Claude Code CLI, then re-run ck init to enable /ck:* plugin skills");
			}
		} else {
			logger.info(
				`Plugin install skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
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
			// Note: CC availability already confirmed by requireCCPluginSupport() above.
			// handlePluginInstall() re-checks internally (isClaudeAvailable) as a safety guard
			// for callers that skip the version gate. Cost: one extra subprocess spawn.
			const pluginResult = await handlePluginInstall(ctx.extractDir);
			pluginVerified = pluginResult.verified;
			if (pluginResult.error) {
				logger.info(`Plugin install issue: ${pluginResult.error}`);
			}
		} catch (error) {
			// Non-fatal: plugin install is optional enhancement
			logger.debug(
				`Plugin install skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	// Record plugin state in metadata for idempotent re-runs.
	// Write explicit false when unsupported so stale truthy flags are cleared.
	if (ctx.claudeDir && ctx.kitType) {
		try {
			const { updateKitPluginState } = await import("@/domains/migration/metadata-migration.js");
			await updateKitPluginState(ctx.claudeDir, ctx.kitType, {
				pluginInstalled: pluginVerified,
				pluginInstalledAt: new Date().toISOString(),
				pluginVersion: ctx.selectedVersion || "unknown",
			});
		} catch {
			// Non-fatal: metadata tracking is best-effort
		}
	}

	// Process deferred skill deletions (from Phase 7 merge-handler)
	// Only delete skills after plugin verification + user skill migration
	if (ctx.deferredDeletions?.length && ctx.claudeDir) {
		try {
			const { migrateUserSkills } = await import("@/services/skill-migration-merger.js");
			const migration = await migrateUserSkills(ctx.claudeDir, pluginVerified);

			if (pluginVerified) {
				if (!migration.canDelete) {
					logger.warning(
						"Skill migration metadata unavailable — preserving existing skills (fail-safe)",
					);
					return { ...ctx, installSkills, pluginSupported };
				}

				// Filter out user-preserved skills from deferred deletions
				const preservedDirs = new Set(migration.preserved.map(normalizeSkillDir));
				const safeDeletions = ctx.deferredDeletions.filter((d) => {
					const dirPath = extractSkillDirFromDeletionPath(d);
					if (!dirPath) return true;
					return !preservedDirs.has(normalizeSkillDir(dirPath));
				});

				if (safeDeletions.length > 0) {
					const { handleDeletions } = await import("@/domains/installation/deletion-handler.js");
					const deferredResult = await handleDeletions({ deletions: safeDeletions }, ctx.claudeDir);
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

	// Safety net: scan for standalone skills that overlap with plugin
	// Catches skills not listed in metadata.json deletions
	if (pluginVerified) {
		try {
			const { cleanupOverlappingStandaloneSkills } = await import(
				"@/services/standalone-skill-cleanup.js"
			);
			// Plugin is user-wide, so standalone overrides always live in global ~/.claude/skills/
			const globalClaudeDir = PathResolver.getGlobalKitDir();
			const pluginSkillsDir = join(
				PathResolver.getClaudeKitDir(),
				"marketplace",
				"plugins",
				"ck",
				"skills",
			);
			const overlap = await cleanupOverlappingStandaloneSkills(globalClaudeDir, pluginSkillsDir);
			if (overlap.removed.length > 0) {
				logger.info(
					`Cleaned up ${overlap.removed.length} standalone skill(s) now provided by /ck:* plugin`,
				);
			}
		} catch (error) {
			logger.debug(`Standalone skill cleanup failed: ${error}`);
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

function normalizeSkillDir(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function extractSkillDirFromDeletionPath(path: string): string | null {
	const normalized = normalizeSkillDir(path);
	const parts = normalized.split("/").filter(Boolean);
	if (parts.length < 2 || parts[0] !== "skills") {
		return null;
	}
	return `skills/${parts[1]}`;
}
