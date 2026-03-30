/**
 * Standalone migrate nudge + auto-chain (decoupled from init pipeline).
 * Detects installed providers and either:
 * - Auto-runs ck migrate for configured users (autoMigrateAfterInit) — takes priority
 * - Shows nudge banner for first-timers (no migrate history, interactive only)
 *
 * Note: This module is no longer called from post-install-handler.
 * It defines its own config shape for migrate-specific settings.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { CkConfigManager } from "@/domains/config/ck-config-manager.js";
import { logger } from "@/shared/logger.js";
import { confirm, isCancel, note } from "@/shared/safe-prompts.js";
import type { InitContext } from "../types.js";

const execAsync = promisify(exec);

/** Migrate-specific pipeline config (decoupled from UpdatePipelineConfig) */
interface MigratePipelineConfig {
	autoMigrateAfterInit?: boolean;
	migrateProviders?: "auto" | string[];
}

type PostInitMigrateConfigLoader = (
	projectDir: string | null,
) => Promise<{ config: { updatePipeline?: Record<string, unknown> } }>;

type PostInitMigrateProviderConfig = { displayName: string };

type PostInitMigrateRegistry = {
	installations: Array<{ provider: string }>;
};

type PostInitMigrateExecFn = (
	command: string,
	options?: { timeout?: number },
) => Promise<{ stdout?: string; stderr?: string } | string>;

type PostInitMigrateConfirmFn = (opts: { message: string }) => Promise<boolean | symbol>;
type PostInitMigrateCancelFn = (value: unknown) => boolean;

export interface PostInitMigrateDeps {
	detectInstalledProvidersFn?: () => Promise<string[]>;
	getProviderConfigFn?: (provider: string) => PostInitMigrateProviderConfig;
	readPortableRegistryFn?: () => Promise<PostInitMigrateRegistry>;
	loadFullConfigFn?: PostInitMigrateConfigLoader;
	confirmFn?: PostInitMigrateConfirmFn;
	isCancelFn?: PostInitMigrateCancelFn;
	noteFn?: typeof note;
	execAsyncFn?: PostInitMigrateExecFn;
}

// Only allow alphanumeric chars and hyphens in provider names (defense-in-depth against injection)
const SAFE_PROVIDER_NAME = /^[a-z0-9-]+$/;

/**
 * Run post-init migrate nudge or auto-chain based on config and history.
 * Called after all init phases complete successfully.
 */
export async function maybePostInitMigrate(
	ctx: InitContext,
	deps?: PostInitMigrateDeps,
): Promise<void> {
	if (ctx.cancelled || !ctx.resolvedDir) return;

	try {
		// Lazy-import portable modules to avoid circular deps and keep init fast when not needed.
		const providerRegistry =
			deps?.detectInstalledProvidersFn && deps?.getProviderConfigFn
				? null
				: await import("@/commands/portable/provider-registry.js");
		const portableRegistry = deps?.readPortableRegistryFn
			? null
			: await import("@/commands/portable/portable-registry.js");
		const detectInstalledProvidersFn: PostInitMigrateDeps["detectInstalledProvidersFn"] =
			deps?.detectInstalledProvidersFn ??
			(providerRegistry?.detectInstalledProviders as PostInitMigrateDeps["detectInstalledProvidersFn"]);
		const getProviderConfigFn: PostInitMigrateDeps["getProviderConfigFn"] =
			deps?.getProviderConfigFn ??
			(providerRegistry?.getProviderConfig as PostInitMigrateDeps["getProviderConfigFn"]);
		const readPortableRegistryFn: PostInitMigrateDeps["readPortableRegistryFn"] =
			deps?.readPortableRegistryFn ??
			(portableRegistry?.readPortableRegistry as PostInitMigrateDeps["readPortableRegistryFn"]);
		const loadFullConfigFn = deps?.loadFullConfigFn ?? CkConfigManager.loadFull;

		if (!detectInstalledProvidersFn || !getProviderConfigFn || !readPortableRegistryFn) {
			return;
		}

		// Detect installed providers (excludes claude-code — it's the source, not a target)
		const allProviders = await detectInstalledProvidersFn();
		const targets = allProviders.filter((p) => p !== "claude-code");
		if (targets.length === 0) return;

		const providerNames = targets.map((p) => getProviderConfigFn(p).displayName).join(", ");

		// Check portable registry for prior migrate history
		const registry = await readPortableRegistryFn();
		const hasHistory = registry.installations.some((i) => i.provider !== "claude-code");

		// Load config for auto-chain decision (cast to local migrate-specific shape)
		const ckConfig = await loadFullConfigFn(ctx.options.global ? null : ctx.resolvedDir);
		const pipeline = ckConfig.config.updatePipeline as Partial<MigratePipelineConfig> | undefined;
		const autoMigrate = pipeline?.autoMigrateAfterInit ?? false;

		// Route: config-driven auto-chain takes priority over interactive nudge
		if (autoMigrate) {
			await runAutoMigrate(ctx, pipeline, targets, providerNames, deps);
		} else if (!hasHistory && !ctx.isNonInteractive) {
			await showNudge(ctx, providerNames, deps);
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
	deps?: PostInitMigrateDeps,
): Promise<void> {
	const noteFn = deps?.noteFn ?? note;
	const confirmFn = deps?.confirmFn ?? confirm;
	const isCancelFn = deps?.isCancelFn ?? isCancel;
	const execAsyncFn = deps?.execAsyncFn ?? execAsync;

	noteFn(
		[
			`Detected providers: ${providerNames}`,
			"Run `ck migrate` to sync your kit to these providers.",
			"Set `autoMigrateAfterInit: true` in .ck.json to auto-sync on future updates.",
		].join("\n"),
		"[i] Provider Sync Available",
	);

	const shouldMigrate = await confirmFn({
		message: "Run ck migrate now?",
	});

	if (isCancelFn(shouldMigrate) || !shouldMigrate) return;

	const parts = ["ck", "migrate"];
	if (ctx.options.global) parts.push("-g");
	parts.push("--yes");
	const cmd = parts.join(" ");

	try {
		logger.info(`Running: ${cmd}`);
		await execAsyncFn(cmd, { timeout: 300000 });
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
	pipeline: Partial<MigratePipelineConfig> | undefined,
	detectedTargets: string[],
	providerNames: string,
	deps?: PostInitMigrateDeps,
): Promise<void> {
	const execAsyncFn = deps?.execAsyncFn ?? execAsync;

	// Resolve which providers to migrate
	let providers: string[];
	if (!pipeline?.migrateProviders || pipeline.migrateProviders === "auto") {
		providers = detectedTargets;
	} else if (Array.isArray(pipeline.migrateProviders)) {
		// Explicit list — filter to only installed providers
		const invalid = pipeline.migrateProviders.filter((p) => !detectedTargets.includes(p));
		if (invalid.length > 0) {
			logger.warning(`Unknown/uninstalled providers in migrateProviders: ${invalid.join(", ")}`);
		}
		providers = pipeline.migrateProviders.filter((p) => detectedTargets.includes(p));
	} else {
		// Unexpected type — skip silently
		return;
	}

	if (providers.length === 0) return;

	// Validate provider names against safe pattern (defense-in-depth against shell injection)
	const safeProviders = providers.filter((p) => SAFE_PROVIDER_NAME.test(p));
	if (safeProviders.length !== providers.length) {
		logger.warning("Some provider names contain invalid characters and were skipped");
	}
	if (safeProviders.length === 0) return;

	const parts = ["ck", "migrate"];
	if (ctx.options.global) parts.push("-g");
	for (const p of safeProviders) {
		parts.push("--agent", p);
	}
	parts.push("--yes");
	const cmd = parts.join(" ");

	logger.info(`Auto-migrating to: ${providerNames}`);

	try {
		await execAsyncFn(cmd, { timeout: 300000 });
		logger.success("Auto-migration complete");
	} catch (error) {
		logger.warning(
			`Auto-migration failed: ${error instanceof Error ? error.message : "unknown"}. Run \`ck migrate\` manually to retry.`,
		);
	}
}
