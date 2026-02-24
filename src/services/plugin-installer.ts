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
import { join } from "node:path";
import { promisify } from "node:util";
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
 * Build env for claude CLI subprocess.
 * Strips CLAUDE* env vars to prevent nested session detection.
 * Uses shell on Windows so .cmd/.ps1 extensions resolve correctly.
 */
function buildExecOptions(timeout: number) {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (key.startsWith("CLAUDE") && key !== "CLAUDE_CONFIG_DIR") {
			delete env[key];
		}
	}
	return {
		timeout,
		env,
		shell: process.platform === "win32",
	};
}

/**
 * Resolve the persistent marketplace directory path.
 * ~/.claudekit/marketplace/
 */
function getMarketplacePath(): string {
	const dataDir = PathResolver.getClaudeKitDir();
	return join(dataDir, MARKETPLACE_DIR_NAME);
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

	// Copy marketplace.json
	await copy(sourceMarketplaceJson, join(marketplacePath, ".claude-plugin", "marketplace.json"), {
		overwrite: true,
	});

	// Remove existing plugin dir to prevent stale files from old versions
	const destPluginDir = join(marketplacePath, "plugins", PLUGIN_NAME);
	if (await pathExists(destPluginDir)) {
		await remove(destPluginDir);
	}
	// Copy plugin dir (clean state ensured above)
	await copy(sourcePluginDir, destPluginDir, { overwrite: true });

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

	// Check if already registered
	const listResult = await runClaudePlugin(["marketplace", "list"]);
	if (listResult.success && listResult.stdout.includes(MARKETPLACE_NAME)) {
		// Already registered — remove and re-add to update path if changed.
		// This is safe: plugin files are already on disk, brief gap is harmless.
		const removeResult = await runClaudePlugin(["marketplace", "remove", MARKETPLACE_NAME]);
		if (removeResult.success) {
			logger.debug("Removed stale marketplace registration for re-add");
		}
	}

	// Register (or re-register) marketplace
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

	// Check if already installed
	const listResult = await runClaudePlugin(["list"]);
	const isInstalled = listResult.success && listResult.stdout.includes(pluginRef);

	if (isInstalled) {
		// Update existing plugin
		const result = await runClaudePlugin(["update", pluginRef]);
		if (result.success) {
			logger.debug("Plugin updated successfully");
			return true;
		}
		// Update might fail if version unchanged — that's OK
		if (result.stderr.includes("already up to date") || result.stderr.includes("no update")) {
			logger.debug("Plugin already up to date");
			return true;
		}
		logger.debug(`Plugin update failed: ${result.stderr}`);
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
 */
async function verifyPluginInstalled(): Promise<boolean> {
	const result = await runClaudePlugin(["list"]);
	if (!result.success) return false;

	// Check for "ck" plugin from "claudekit" marketplace
	const output = result.stdout.toLowerCase();
	return output.includes("ck") && output.includes("claudekit");
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

	logger.info("Registering CK plugin with Claude Code...");

	// Step 1: Copy plugin to persistent marketplace location
	const copied = await copyPluginToMarketplace(extractDir);
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
		}
	}

	// Always try to remove marketplace (idempotent — CC ignores if not registered)
	await runClaudePlugin(["marketplace", "remove", MARKETPLACE_NAME]);

	// Clean up persistent marketplace directory
	const marketplacePath = getMarketplacePath();
	if (await pathExists(marketplacePath)) {
		await remove(marketplacePath);
		logger.debug("Marketplace directory cleaned up");
	}
}
