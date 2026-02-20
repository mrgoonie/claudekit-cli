/**
 * CC Plugin Installer
 * Handles Claude Code plugin marketplace registration and plugin installation
 * for the CK skill namespace (ck:*).
 *
 * Flow:
 * 1. Copy plugin from kit release to persistent location (~/.claudekit/marketplace/)
 * 2. Register local marketplace with CC (`claude plugin marketplace add`)
 * 3. Install or update plugin (`claude plugin install/update ck@claudekit`)
 *
 * This runs transparently during `ck init` — users never interact with CC plugin commands.
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
 * Build env for claude CLI subprocess.
 * Removes CLAUDECODE to bypass nested session check when running inside CC.
 * Uses shell on Windows so .cmd/.ps1 extensions resolve correctly.
 */
function buildExecOptions(timeout: number) {
	const env = { ...process.env };
	env.CLAUDECODE = undefined;
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

	// Copy plugin dir (overwrite handles existing files; no remove needed)
	const destPluginDir = join(marketplacePath, "plugins", PLUGIN_NAME);
	await copy(sourcePluginDir, destPluginDir, { overwrite: true });

	logger.debug("Plugin copied to marketplace");
	return true;
}

/**
 * Register the local marketplace with Claude Code.
 * Idempotent — re-registers if already exists (updates path).
 */
async function registerMarketplace(): Promise<boolean> {
	const marketplacePath = getMarketplacePath();

	// Check if already registered
	const listResult = await runClaudePlugin(["marketplace", "list"]);
	if (listResult.success && listResult.stdout.includes(MARKETPLACE_NAME)) {
		// Already registered — remove and re-add to ensure path is current
		await runClaudePlugin(["marketplace", "remove", MARKETPLACE_NAME]);
		logger.debug("Removed stale marketplace registration");
	}

	// Register marketplace
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
 * Copy plugin skills to .claude/skills/ as fallback when plugin install fails.
 * This ensures users always have working skills even without CC plugin support.
 * Skills work with bare names (/cook, /debug) instead of namespaced (/ck:cook).
 */
async function copySkillsFallback(extractDir: string, claudeDir: string): Promise<void> {
	const sourceSkillsDir = join(extractDir, "plugins", PLUGIN_NAME, "skills");
	const destSkillsDir = join(claudeDir, "skills");

	if (!(await pathExists(sourceSkillsDir))) {
		logger.debug("No plugin skills to copy as fallback");
		return;
	}

	await ensureDir(destSkillsDir);
	await copy(sourceSkillsDir, destSkillsDir, { overwrite: true });
	logger.info("Skills copied to .claude/skills/ (bare names — plugin not available)");
}

/**
 * Main entry point: handle full plugin installation pipeline.
 * Called from post-install phase of `ck init`.
 *
 * If plugin install fails (CC not available, old version, error),
 * falls back to copying skills directly to .claude/skills/ so users
 * always have working skills regardless of CC plugin support.
 *
 * @param extractDir - Path to the extracted kit release (temp dir)
 * @param claudeDir - Path to user's .claude directory (for fallback copy)
 * @returns true if plugin was installed/updated, false if fell back to direct copy
 */
export async function handlePluginInstall(
	extractDir: string,
	claudeDir?: string,
): Promise<boolean> {
	// Step 0: Check if Claude Code CLI is available
	if (!(await isClaudeAvailable())) {
		logger.debug("Claude Code CLI not found — using direct skills copy");
		if (claudeDir) await copySkillsFallback(extractDir, claudeDir);
		return false;
	}

	logger.info("Registering CK plugin with Claude Code...");

	// Step 1: Copy plugin to persistent marketplace location
	const copied = await copyPluginToMarketplace(extractDir);
	if (!copied) {
		if (claudeDir) await copySkillsFallback(extractDir, claudeDir);
		return false;
	}

	// Step 2: Register marketplace
	const registered = await registerMarketplace();
	if (!registered) {
		logger.warning("Could not register plugin marketplace — falling back to bare skill names");
		if (claudeDir) await copySkillsFallback(extractDir, claudeDir);
		return false;
	}

	// Step 3: Install or update plugin
	const installed = await installOrUpdatePlugin();
	if (!installed) {
		logger.warning("Could not install CK plugin — falling back to bare skill names");
		if (claudeDir) await copySkillsFallback(extractDir, claudeDir);
		return false;
	}

	logger.success("CK plugin installed — skills available as /ck:* commands");
	return true;
}

/**
 * Remove CK plugin and marketplace registration from Claude Code.
 * Called from `ck uninstall` to clean up plugin artifacts.
 * All operations are non-fatal — failures are logged and skipped.
 */
export async function handlePluginUninstall(): Promise<void> {
	if (!(await isClaudeAvailable())) {
		logger.debug("Claude Code CLI not found — skipping plugin cleanup");
		return;
	}

	const pluginRef = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

	// Uninstall plugin from CC
	const uninstallResult = await runClaudePlugin(["uninstall", pluginRef]);
	if (uninstallResult.success) {
		logger.debug("CK plugin uninstalled from Claude Code");
	}

	// Remove marketplace registration
	const removeResult = await runClaudePlugin(["marketplace", "remove", MARKETPLACE_NAME]);
	if (removeResult.success) {
		logger.debug("Marketplace registration removed");
	}

	// Remove persistent marketplace directory
	const marketplacePath = getMarketplacePath();
	if (await pathExists(marketplacePath)) {
		await remove(marketplacePath);
		logger.debug("Marketplace directory cleaned up");
	}
}
