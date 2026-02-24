/**
 * CC Plugin Installer
 * Handles Claude Code plugin marketplace registration and plugin installation
 * for the CK skill namespace (ck:*).
 *
 * Flow:
 * 1. Copy plugin from kit release to persistent location (~/.claudekit/marketplace/)
 * 2. Register local marketplace with CC (`claude plugin marketplace add`)
 * 3. Install or update plugin (`claude plugin install/update ck@claudekit`)
 * 4. Verify plugin is installed and usable
 *
 * This runs transparently during `ck init` — users never interact with CC plugin commands.
 * Plugin-only: requires CC >= 1.0.33 (version gate in cc-version-checker.ts).
 */

import { execFile } from "node:child_process";
import { rename } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
/**
 * buildExecOptions strips CLAUDE* env vars to prevent nested session detection
 * (CC refuses to spawn if CLAUDECODE/CLAUDE_* vars signal a parent session),
 * and sets shell:true on Windows so .cmd/.ps1 extensions resolve correctly.
 */
import { buildExecOptions } from "@/shared/claude-exec-options.js";
import { logger } from "@/shared/logger.js";
import { PathResolver } from "@/shared/path-resolver.js";
import { copy, ensureDir, pathExists, remove } from "fs-extra";

const execFileAsync = promisify(execFile);

/** Persistent marketplace location under ~/.claudekit/ */
const MARKETPLACE_DIR_NAME = "marketplace";
/** Plugin name registered in plugin.json */
const PLUGIN_NAME = "ck";
/** Marketplace name registered in marketplace.json */
const MARKETPLACE_NAME = "claudekit";

/**
 * Structured result from plugin installation pipeline.
 * Callers use `verified` to decide whether to proceed with skill deletions.
 */
export interface PluginInstallResult {
	/** Plugin successfully installed or updated */
	installed: boolean;
	/** Local marketplace registered with CC */
	marketplaceRegistered: boolean;
	/** Post-install verification passed (plugin actually usable) */
	verified: boolean;
	/** Error description if any step failed */
	error?: string;
}

/**
 * Resolve the persistent marketplace directory path.
 * ~/.claudekit/marketplace/
 */
function getMarketplacePath(): string {
	const dataDir = PathResolver.getClaudeKitDir();
	return join(dataDir, MARKETPLACE_DIR_NAME);
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function outputContainsToken(output: string, token: string): boolean {
	const tokenPattern = new RegExp(`(^|\\s)${escapeRegex(token)}(?=\\s|$)`, "i");
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.some((line) => tokenPattern.test(line));
}

/**
 * Run a `claude plugin` CLI command.
 * Returns { success, stdout, stderr }.
 * Swallows errors gracefully — plugin operations are non-fatal.
 */
async function runClaudePlugin(
	args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
	try {
		const { stdout, stderr } = await execFileAsync(
			"claude",
			["plugin", ...args],
			buildExecOptions(30_000),
		);
		return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
	} catch (error) {
		const err = error as { stdout?: string; stderr?: string; message?: string };
		return {
			success: false,
			stdout: (err.stdout ?? "").trim(),
			stderr: (err.stderr ?? err.message ?? "Unknown error").trim(),
		};
	}
}

/**
 * Check if Claude Code CLI is available on PATH.
 */
async function isClaudeAvailable(): Promise<boolean> {
	try {
		await execFileAsync("claude", ["--version"], buildExecOptions(5_000));
		return true;
	} catch {
		return false;
	}
}

/**
 * Copy plugin marketplace structure from extracted kit to persistent location.
 * Source: <extractDir>/.claude-plugin/marketplace.json + <extractDir>/plugins/ck/
 * Dest:   ~/.claudekit/marketplace/.claude-plugin/marketplace.json + ~/.claudekit/marketplace/plugins/ck/
 */
async function copyPluginToMarketplace(extractDir: string): Promise<boolean> {
	const marketplacePath = getMarketplacePath();
	const sourceMarketplaceJson = join(extractDir, ".claude-plugin", "marketplace.json");
	const sourcePluginDir = join(extractDir, "plugins", PLUGIN_NAME);

	// Check if the kit release contains plugin structure
	if (!(await pathExists(sourceMarketplaceJson)) || !(await pathExists(sourcePluginDir))) {
		logger.debug("Kit release does not contain plugin structure — skipping plugin install");
		return false;
	}

	// Ensure marketplace dir exists
	await ensureDir(join(marketplacePath, ".claude-plugin"));
	await ensureDir(join(marketplacePath, "plugins"));

	const suffix = `${process.pid}-${Date.now()}`;
	const destMarketplaceJson = join(marketplacePath, ".claude-plugin", "marketplace.json");
	const destPluginDir = join(marketplacePath, "plugins", PLUGIN_NAME);
	const tempMarketplaceJson = `${destMarketplaceJson}.tmp-${suffix}`;
	const tempPluginDir = `${destPluginDir}.tmp-${suffix}`;
	const backupMarketplaceJson = `${destMarketplaceJson}.bak-${suffix}`;
	const backupPluginDir = `${destPluginDir}.bak-${suffix}`;

	await remove(tempMarketplaceJson).catch(() => {});
	await remove(tempPluginDir).catch(() => {});
	await remove(backupMarketplaceJson).catch(() => {});
	await remove(backupPluginDir).catch(() => {});

	// Stage copies first so we never touch active plugin paths on copy failure.
	await copy(sourceMarketplaceJson, tempMarketplaceJson, { overwrite: true });
	await copy(sourcePluginDir, tempPluginDir, { overwrite: true });

	let backupMarketplaceCreated = false;
	let backupPluginCreated = false;
	let marketplaceReplaced = false;
	let pluginReplaced = false;

	try {
		if (await pathExists(destMarketplaceJson)) {
			await rename(destMarketplaceJson, backupMarketplaceJson);
			backupMarketplaceCreated = true;
		}
		await rename(tempMarketplaceJson, destMarketplaceJson);
		marketplaceReplaced = true;

		if (await pathExists(destPluginDir)) {
			await rename(destPluginDir, backupPluginDir);
			backupPluginCreated = true;
		}
		await rename(tempPluginDir, destPluginDir);
		pluginReplaced = true;
	} catch (error) {
		// Roll back best-effort to keep previous plugin version intact.
		if (marketplaceReplaced) {
			await remove(destMarketplaceJson).catch(() => {});
		}
		if (pluginReplaced) {
			await remove(destPluginDir).catch(() => {});
		}
		if (backupMarketplaceCreated) {
			await rename(backupMarketplaceJson, destMarketplaceJson).catch(() => {});
		}
		if (backupPluginCreated) {
			await rename(backupPluginDir, destPluginDir).catch(() => {});
		}
		await remove(tempMarketplaceJson).catch(() => {});
		await remove(tempPluginDir).catch(() => {});
		throw error;
	}

	// Cleanup backups after successful swap.
	await remove(backupMarketplaceJson).catch(() => {});
	await remove(backupPluginDir).catch(() => {});
	await remove(tempMarketplaceJson).catch(() => {});
	await remove(tempPluginDir).catch(() => {});

	logger.debug("Plugin copied to marketplace");
	return true;
}

/**
 * Register the local marketplace with Claude Code.
 * Idempotent — if already registered, attempts re-add (CC handles duplicates).
 * No remove+add cycle — eliminates crash window where marketplace is missing.
 */
async function registerMarketplace(): Promise<boolean> {
	const marketplacePath = getMarketplacePath();

	// Check if already registered using line-based matching to avoid false substring hits
	const listResult = await runClaudePlugin(["marketplace", "list"]);
	const alreadyRegistered =
		listResult.success && outputContainsToken(listResult.stdout, MARKETPLACE_NAME);

	if (alreadyRegistered) {
		// Try add first — if it succeeds (CC overwrites), we're done.
		// Only remove+retry if add fails due to existing conflicting registration.
		const addResult = await runClaudePlugin(["marketplace", "add", marketplacePath]);
		if (addResult.success) {
			logger.debug("Marketplace re-registered successfully");
			return true;
		}
		// Add failed — remove stale entry then retry
		logger.debug("Marketplace add failed while registered; removing stale entry and retrying");
		const removeResult = await runClaudePlugin(["marketplace", "remove", MARKETPLACE_NAME]);
		if (!removeResult.success) {
			logger.debug(`Marketplace remove failed: ${removeResult.stderr}`);
			return false;
		}
		const retryResult = await runClaudePlugin(["marketplace", "add", marketplacePath]);
		if (!retryResult.success) {
			logger.warning(`Marketplace remove succeeded but retry-add failed: ${retryResult.stderr}`);
			return false;
		}
		logger.debug("Marketplace re-registered after remove+retry");
		return true;
	}

	// Not yet registered — fresh add
	const result = await runClaudePlugin(["marketplace", "add", marketplacePath]);
	if (!result.success) {
		logger.debug(`Marketplace registration failed: ${result.stderr}`);
		return false;
	}

	logger.debug("Marketplace registered successfully");
	return true;
}

/**
 * Install or update the CK plugin.
 * Tries install first — if already installed, runs update instead.
 */
async function installOrUpdatePlugin(): Promise<boolean> {
	const pluginRef = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

	// Check if already installed using line-based matching to avoid false substring hits
	const listResult = await runClaudePlugin(["list"]);
	const isInstalled = listResult.success && outputContainsToken(listResult.stdout, pluginRef);

	if (isInstalled) {
		// Update existing plugin
		const result = await runClaudePlugin(["update", pluginRef]);
		if (result.success) {
			logger.debug("Plugin updated successfully");
			return true;
		}
		// Update failed — consequence is low: plugin was already installed.
		// Re-verify via list to confirm plugin is still present and usable.
		logger.debug(`Plugin update failed (${result.stderr}); re-verifying install state`);
		const stillInstalled = await verifyPluginInstalled();
		if (stillInstalled) {
			logger.debug("Plugin update failed but plugin is still installed — treating as success");
			return true;
		}
		logger.debug("Plugin update failed and plugin is no longer listed");
		return false;
	}

	// Fresh install
	const result = await runClaudePlugin(["install", pluginRef]);
	if (!result.success) {
		logger.debug(`Plugin install failed: ${result.stderr}`);
		return false;
	}

	logger.debug("Plugin installed successfully");
	return true;
}

/**
 * Verify the CK plugin is installed and usable via `claude plugin list`.
 * Returns true if the plugin appears in the installed plugins list.
 * Uses the same pluginRef token check as installOrUpdatePlugin to avoid
 * false negatives when CC outputs "ck@claudekit" as a single token.
 */
async function verifyPluginInstalled(): Promise<boolean> {
	const pluginRef = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;
	const result = await runClaudePlugin(["list"]);
	if (!result.success) return false;

	return outputContainsToken(result.stdout, pluginRef);
}

/**
 * Main entry point: handle full plugin installation pipeline.
 * Called from post-install phase of `ck init`.
 *
 * Returns structured result — callers use `verified` to gate skill deletions.
 * No fallback copy: this release requires CC >= 1.0.33 (enforced by version gate).
 *
 * @param extractDir - Path to the extracted kit release (temp dir)
 * @returns Structured result with installation and verification status
 */
export async function handlePluginInstall(extractDir: string): Promise<PluginInstallResult> {
	// Step 0: Check if Claude Code CLI is available
	if (!(await isClaudeAvailable())) {
		return {
			installed: false,
			marketplaceRegistered: false,
			verified: false,
			error: "Claude Code CLI not found on PATH",
		};
	}

	logger.debug("Registering CK plugin with Claude Code...");

	// Step 1: Copy plugin to persistent marketplace location
	let copied = false;
	try {
		copied = await copyPluginToMarketplace(extractDir);
	} catch (error) {
		return {
			installed: false,
			marketplaceRegistered: false,
			verified: false,
			error: `Plugin copy failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
	if (!copied) {
		return {
			installed: false,
			marketplaceRegistered: false,
			verified: false,
			error: "No plugin found in kit release",
		};
	}

	// Step 2: Register marketplace
	const registered = await registerMarketplace();
	if (!registered) {
		return {
			installed: false,
			marketplaceRegistered: false,
			verified: false,
			error: "Marketplace registration failed",
		};
	}

	// Step 3: Install or update plugin
	const installOk = await installOrUpdatePlugin();
	if (!installOk) {
		return {
			installed: false,
			marketplaceRegistered: true,
			verified: false,
			error: "Plugin install/update failed",
		};
	}

	// Step 4: Verify plugin is actually usable
	const verified = await verifyPluginInstalled();
	if (verified) {
		logger.success("CK plugin installed — skills available as /ck:* commands");
	} else {
		logger.warning("Plugin installed but verification failed — skills may not be available");
	}

	return {
		installed: true,
		marketplaceRegistered: true,
		verified,
		error: verified ? undefined : "Post-install verification failed",
	};
}

/**
 * Remove CK plugin and marketplace registration from Claude Code.
 * Called from `ck uninstall` to clean up plugin artifacts.
 * Idempotent — safe to call even if plugin/marketplace not registered.
 */
export async function handlePluginUninstall(): Promise<void> {
	if (!(await isClaudeAvailable())) {
		logger.debug("Claude Code CLI not found — skipping plugin cleanup");
		return;
	}

	// Check if plugin is installed before attempting uninstall
	const isInstalled = await verifyPluginInstalled();
	if (isInstalled) {
		const pluginRef = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;
		const uninstallResult = await runClaudePlugin(["uninstall", pluginRef]);
		if (uninstallResult.success) {
			logger.debug("CK plugin uninstalled from Claude Code");
		} else {
			logger.debug(`Plugin uninstall failed: ${uninstallResult.stderr}`);
		}
	}

	// Always try to remove marketplace (idempotent — CC ignores if not registered)
	const marketplaceRemoveResult = await runClaudePlugin([
		"marketplace",
		"remove",
		MARKETPLACE_NAME,
	]);
	if (!marketplaceRemoveResult.success) {
		logger.debug(`Marketplace remove failed: ${marketplaceRemoveResult.stderr}`);
	}

	// Clean up persistent marketplace directory
	const marketplacePath = getMarketplacePath();
	if (await pathExists(marketplacePath)) {
		try {
			await remove(marketplacePath);
			logger.debug("Marketplace directory cleaned up");
		} catch (error) {
			logger.warning(
				`Failed to clean marketplace directory: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
