/**
 * Post-init migrate nudge + auto-chain
 * Detects installed providers after ck init and either:
 * - Shows nudge banner for first-timers (no migrate history)
 * - Auto-runs ck migrate for configured users (autoMigrateAfterInit)
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { CkConfigManager } from "@/domains/config/ck-config-manager.js";
import { logger } from "@/shared/logger.js";
import { confirm, isCancel, note } from "@/shared/safe-prompts.js";
import type { InitContext } from "../types.js";

const execAsync = promisify(exec);

/**
 * Run post-init migrate nudge or auto-chain based on config and history.
 * Called after all init phases complete successfully.
 */
export async function maybePostInitMigrate(ctx: InitContext): Promise<void> {
	if (ctx.cancelled || !ctx.resolvedDir) return;

	try {
		// Lazy-import portable modules to avoid circular deps and keep init fast when not needed
		const { detectInstalledProviders, getProviderConfig } = await import(
			"@/commands/portable/provider-registry.js"
		);
		const { readPortableRegistry } = await import("@/commands/portable/portable-registry.js");

		// Detect installed providers (excludes claude-code — it's the source, not a target)
		const allProviders = await detectInstalledProviders();
		const targets = allProviders.filter((p) => p !== "claude-code");
		if (targets.length === 0) return;

		const providerNames = targets.map((p) => getProviderConfig(p).displayName).join(", ");

		// Check portable registry for prior migrate history
		const registry = await readPortableRegistry();
		const hasHistory = registry.installations.some((i) => i.provider !== "claude-code");

		// Load config for auto-chain decision
		const ckConfig = await CkConfigManager.loadFull(ctx.options.global ? null : ctx.resolvedDir);
		const pipeline = ckConfig.config.updatePipeline;
		const autoMigrate = pipeline?.autoMigrateAfterInit ?? false;

		// Route: first-timer nudge OR config-driven auto-chain
		if (!hasHistory && !ctx.isNonInteractive) {
			await showNudge(ctx, providerNames, targets);
		} else if (autoMigrate) {
			await runAutoMigrate(ctx, pipeline, targets, providerNames);
		}
	} catch (error) {
		// Non-fatal — init was successful, migrate nudge is best-effort
		logger.debug(
			`Post-init migrate check skipped: ${error instanceof Error ? error.message : "unknown"}`,
		);
	}
}

/**
 * Show nudge banner for first-timers and offer to run migrate.
 */
async function showNudge(
	ctx: InitContext,
	providerNames: string,
	_targets: string[],
): Promise<void> {
	note(
		[
			`Detected providers: ${providerNames}`,
			"Run `ck migrate` to sync your kit to these providers.",
			"Set `autoMigrateAfterInit: true` in .ck.json to auto-sync on future updates.",
		].join("\n"),
		"[i] Provider Sync Available",
	);

	const shouldMigrate = await confirm({
		message: "Run ck migrate now?",
	});

	if (isCancel(shouldMigrate) || !shouldMigrate) return;

	const scope = ctx.options.global ? "-g " : "";
	const cmd = `ck migrate ${scope}--yes`;

	try {
		logger.info(`Running: ${cmd}`);
		await execAsync(cmd, { timeout: 300000 });
		logger.success("Migration complete");
	} catch (error) {
		logger.warning(
			`Migration failed: ${error instanceof Error ? error.message : "unknown"}. Run \`ck migrate\` manually to retry.`,
		);
	}
}

/**
 * Auto-run migrate based on updatePipeline config.
 */
async function runAutoMigrate(
	ctx: InitContext,
	pipeline: { migrateProviders?: string | string[] } | undefined,
	detectedTargets: string[],
	providerNames: string,
): Promise<void> {
	// Resolve which providers to migrate
	let providers: string[];
	if (!pipeline?.migrateProviders || pipeline.migrateProviders === "auto") {
		providers = detectedTargets;
	} else {
		// Explicit list — filter to only installed providers
		const explicit = pipeline.migrateProviders as string[];
		const invalid = explicit.filter((p) => !detectedTargets.includes(p));
		if (invalid.length > 0) {
			logger.warning(`Unknown/uninstalled providers in migrateProviders: ${invalid.join(", ")}`);
		}
		providers = explicit.filter((p) => detectedTargets.includes(p));
	}

	if (providers.length === 0) return;

	const scope = ctx.options.global ? "-g " : "";
	const agents = providers.map((p) => `--agent ${p}`).join(" ");
	const cmd = `ck migrate ${scope}${agents} --yes`;

	logger.info(`Auto-migrating to: ${providerNames}`);

	try {
		await execAsync(cmd, { timeout: 300000 });
		logger.success("Auto-migration complete");
	} catch (error) {
		logger.warning(
			`Auto-migration failed: ${error instanceof Error ? error.message : "unknown"}. Run \`ck migrate\` manually to retry.`,
		);
	}
}
