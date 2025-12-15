/**
 * Gemini CLI MCP Configuration Linker
 *
 * Enables Gemini CLI to use the same MCP servers as Claude Code.
 *
 * HYBRID APPROACH:
 * - If NO .gemini/settings.json exists → Create symlink to .mcp.json (auto-syncs)
 * - If .gemini/settings.json EXISTS → Selective merge (preserve user settings, inject mcpServers)
 *
 * MCP Config Priority:
 * 1. Local project `.mcp.json` (if exists)
 * 2. Global `~/.claude/.mcp.json` (fallback)
 *
 * Cross-platform:
 * - Linux/macOS: Creates symbolic link
 * - Windows: Attempts symlink, falls back to merge if no admin rights
 */

import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { logger } from "@/shared/logger.js";

export interface GeminiLinkResult {
	success: boolean;
	method: "symlink" | "merge" | "skipped";
	targetPath?: string;
	geminiSettingsPath?: string;
	error?: string;
}

export interface GeminiLinkOptions {
	skipGitignore?: boolean;
	isGlobal?: boolean;
}

/**
 * Get the global MCP config path (~/.claude/.mcp.json)
 */
function getGlobalMcpConfigPath(): string {
	return join(homedir(), ".claude", ".mcp.json");
}

/**
 * Get the local MCP config path (./.mcp.json relative to project dir)
 */
function getLocalMcpConfigPath(projectDir: string): string {
	return join(projectDir, ".mcp.json");
}

/**
 * Find the MCP config file with priority:
 * 1. Local project .mcp.json
 * 2. Global ~/.claude/.mcp.json
 */
export function findMcpConfigPath(projectDir: string): string | null {
	// Priority 1: Local project config
	const localPath = getLocalMcpConfigPath(projectDir);
	if (existsSync(localPath)) {
		logger.debug(`Found local MCP config: ${localPath}`);
		return localPath;
	}

	// Priority 2: Global config
	const globalPath = getGlobalMcpConfigPath();
	if (existsSync(globalPath)) {
		logger.debug(`Found global MCP config: ${globalPath}`);
		return globalPath;
	}

	logger.debug("No MCP config found (local or global)");
	return null;
}

/**
 * Get the Gemini settings path based on install type
 * - Global: ~/.gemini/settings.json (Gemini CLI's global config location)
 * - Local: projectDir/.gemini/settings.json
 */
export function getGeminiSettingsPath(projectDir: string, isGlobal: boolean): string {
	if (isGlobal) {
		return join(homedir(), ".gemini", "settings.json");
	}
	return join(projectDir, ".gemini", "settings.json");
}

/**
 * Check if .gemini/settings.json already exists
 */
export function checkExistingGeminiConfig(
	projectDir: string,
	isGlobal = false,
): {
	exists: boolean;
	isSymlink: boolean;
	currentTarget?: string;
	settingsPath: string;
} {
	const geminiSettingsPath = getGeminiSettingsPath(projectDir, isGlobal);

	if (!existsSync(geminiSettingsPath)) {
		return { exists: false, isSymlink: false, settingsPath: geminiSettingsPath };
	}

	try {
		const stats = lstatSync(geminiSettingsPath);
		if (stats.isSymbolicLink()) {
			const target = readlinkSync(geminiSettingsPath);
			return {
				exists: true,
				isSymlink: true,
				currentTarget: target,
				settingsPath: geminiSettingsPath,
			};
		}
		return { exists: true, isSymlink: false, settingsPath: geminiSettingsPath };
	} catch {
		return { exists: true, isSymlink: false, settingsPath: geminiSettingsPath };
	}
}

/**
 * Read and parse JSON file safely
 * Returns null on failure with debug logging for troubleshooting
 */
async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
	try {
		const content = await readFile(filePath, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.debug(`Failed to read/parse JSON file ${filePath}: ${errorMessage}`);
		return null;
	}
}

/**
 * Create symlink with Windows fallback to merge
 * - Local installs: Use relative path (../.mcp.json) for portability
 * - Global installs: Use absolute path to ~/.claude/.mcp.json
 */
async function createSymlink(
	targetPath: string,
	linkPath: string,
	projectDir: string,
	isGlobal: boolean,
): Promise<GeminiLinkResult> {
	const isWindows = process.platform === "win32";

	// Ensure parent directory exists
	const linkDir = dirname(linkPath);
	if (!existsSync(linkDir)) {
		await mkdir(linkDir, { recursive: true });
		logger.debug(`Created directory: ${linkDir}`);
	}

	// Determine symlink target based on install type
	let symlinkTarget: string;
	if (isGlobal) {
		// Global: ~/.gemini/settings.json → ~/.claude/.mcp.json (absolute path)
		symlinkTarget = getGlobalMcpConfigPath();
	} else {
		// Local: Check if using local or global MCP config
		const localMcpPath = join(projectDir, ".mcp.json");
		const isLocalConfig = targetPath === localMcpPath;
		// From .gemini/settings.json, ../.mcp.json points to project root
		symlinkTarget = isLocalConfig ? "../.mcp.json" : targetPath;
	}

	try {
		await symlink(symlinkTarget, linkPath, isWindows ? "file" : undefined);
		logger.debug(`Created symlink: ${linkPath} → ${symlinkTarget}`);
		return { success: true, method: "symlink", targetPath, geminiSettingsPath: linkPath };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			method: "symlink",
			error: `Failed to create symlink: ${errorMessage}`,
		};
	}
}

/**
 * Create new Gemini settings file with mcpServers from MCP config
 * Used as Windows fallback when symlink creation fails (no admin rights)
 */
async function createNewSettingsWithMerge(
	geminiSettingsPath: string,
	mcpConfigPath: string,
): Promise<GeminiLinkResult> {
	// Ensure parent directory exists
	const linkDir = dirname(geminiSettingsPath);
	if (!existsSync(linkDir)) {
		await mkdir(linkDir, { recursive: true });
		logger.debug(`Created directory: ${linkDir}`);
	}

	// Read MCP config
	const mcpConfig = await readJsonFile(mcpConfigPath);
	if (!mcpConfig) {
		return { success: false, method: "merge", error: "Failed to read MCP config" };
	}

	// Extract mcpServers from MCP config (must be object, not array)
	const mcpServers = mcpConfig.mcpServers;
	if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
		return { success: false, method: "merge", error: "MCP config has no valid mcpServers object" };
	}

	// Create new settings file with just mcpServers
	const newSettings = { mcpServers };

	try {
		await writeFile(geminiSettingsPath, JSON.stringify(newSettings, null, 2), "utf-8");
		logger.debug(`Created new Gemini settings with mcpServers: ${geminiSettingsPath}`);
		return { success: true, method: "merge", targetPath: mcpConfigPath };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			method: "merge",
			error: `Failed to write settings: ${errorMessage}`,
		};
	}
}

/**
 * Merge mcpServers from MCP config into existing Gemini settings
 * Preserves all other Gemini settings (theme, preferredEditor, etc.)
 */
async function mergeGeminiSettings(
	geminiSettingsPath: string,
	mcpConfigPath: string,
): Promise<GeminiLinkResult> {
	// Read existing Gemini settings
	const geminiSettings = await readJsonFile(geminiSettingsPath);
	if (!geminiSettings) {
		return { success: false, method: "merge", error: "Failed to read existing Gemini settings" };
	}

	// Read MCP config
	const mcpConfig = await readJsonFile(mcpConfigPath);
	if (!mcpConfig) {
		return { success: false, method: "merge", error: "Failed to read MCP config" };
	}

	// Extract mcpServers from MCP config (must be object, not array)
	const mcpServers = mcpConfig.mcpServers;
	if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
		return { success: false, method: "merge", error: "MCP config has no valid mcpServers object" };
	}

	// Merge: preserve existing Gemini settings, inject/replace mcpServers
	const mergedSettings = {
		...geminiSettings,
		mcpServers,
	};

	try {
		await writeFile(geminiSettingsPath, JSON.stringify(mergedSettings, null, 2), "utf-8");
		logger.debug(`Merged mcpServers into: ${geminiSettingsPath}`);
		return { success: true, method: "merge", targetPath: mcpConfigPath };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			method: "merge",
			error: `Failed to write merged settings: ${errorMessage}`,
		};
	}
}

/**
 * Add .gemini/ to .gitignore if not already present
 */
export async function addGeminiToGitignore(projectDir: string): Promise<void> {
	const gitignorePath = join(projectDir, ".gitignore");
	const geminiPattern = ".gemini/";

	try {
		let content = "";

		if (existsSync(gitignorePath)) {
			content = await readFile(gitignorePath, "utf-8");

			// Check if .gemini/ is already in gitignore (exclude commented lines)
			const lines = content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => !line.startsWith("#")); // Exclude comments
			const geminiPatterns = [".gemini/", ".gemini", "/.gemini/", "/.gemini"];

			if (lines.some((line) => geminiPatterns.includes(line))) {
				logger.debug(".gemini/ already in .gitignore");
				return;
			}
		}

		// Append .gemini/ to gitignore
		const newLine = content.endsWith("\n") || content === "" ? "" : "\n";
		const comment = "# Gemini CLI settings (contains user-specific config)";
		await writeFile(gitignorePath, `${content}${newLine}${comment}\n${geminiPattern}\n`, "utf-8");

		logger.debug(`Added ${geminiPattern} to .gitignore`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		logger.warning(`Failed to update .gitignore: ${errorMessage}`);
	}
}

/**
 * HYBRID APPROACH: Setup Gemini CLI MCP integration
 *
 * - If NO .gemini/settings.json exists → Create symlink (auto-syncs with MCP config)
 * - If .gemini/settings.json EXISTS → Selective merge (preserve user settings)
 *
 * Location behavior:
 * - Global installs: ~/.gemini/settings.json (Gemini CLI's global config)
 * - Local installs: projectDir/.gemini/settings.json
 */
export async function linkGeminiMcpConfig(
	projectDir: string,
	options: GeminiLinkOptions = {},
): Promise<GeminiLinkResult> {
	const { skipGitignore = false, isGlobal = false } = options;
	const resolvedProjectDir = resolve(projectDir);
	const geminiSettingsPath = getGeminiSettingsPath(resolvedProjectDir, isGlobal);

	// Find MCP config
	const mcpConfigPath = findMcpConfigPath(resolvedProjectDir);
	if (!mcpConfigPath) {
		return {
			success: false,
			method: "symlink",
			error: "No MCP config found. Create .mcp.json or ~/.claude/.mcp.json first.",
		};
	}

	// Check for existing Gemini config at the correct location
	const existing = checkExistingGeminiConfig(resolvedProjectDir, isGlobal);

	let result: GeminiLinkResult;

	if (!existing.exists) {
		// CASE 1: No existing config → Create symlink (auto-syncs)
		result = await createSymlink(mcpConfigPath, geminiSettingsPath, resolvedProjectDir, isGlobal);
		// Windows fallback: if symlink fails (no admin rights), fall back to merge
		if (!result.success && process.platform === "win32") {
			logger.debug(
				"Symlink failed on Windows, falling back to creating new settings with mcpServers",
			);
			result = await createNewSettingsWithMerge(geminiSettingsPath, mcpConfigPath);
		}
	} else if (existing.isSymlink) {
		// CASE 2: Already a symlink → Skip (already set up)
		logger.debug(`Gemini config already symlinked: ${existing.currentTarget}`);
		result = {
			success: true,
			method: "skipped",
			targetPath: existing.currentTarget,
			geminiSettingsPath,
		};
	} else {
		// CASE 3: Existing file (not symlink) → Selective merge
		result = await mergeGeminiSettings(geminiSettingsPath, mcpConfigPath);
	}

	// Update gitignore if successful (only for local installs)
	if (result.success && !skipGitignore && !isGlobal) {
		await addGeminiToGitignore(resolvedProjectDir);
	}

	return result;
}

/**
 * Process Gemini MCP linking with user feedback
 * Called after Gemini CLI is installed or during init with auto-detection
 */
export async function processGeminiMcpLinking(
	projectDir: string,
	options: GeminiLinkOptions = {},
): Promise<void> {
	logger.info("Setting up Gemini CLI MCP integration...");

	const result = await linkGeminiMcpConfig(projectDir, options);
	const settingsPath =
		result.geminiSettingsPath ||
		(options.isGlobal ? "~/.gemini/settings.json" : ".gemini/settings.json");

	if (result.success) {
		switch (result.method) {
			case "symlink":
				logger.success(`Gemini MCP linked: ${settingsPath} → ${result.targetPath}`);
				logger.info("MCP servers will auto-sync with your Claude config.");
				break;
			case "merge":
				logger.success("Gemini MCP config updated (merged mcpServers, preserved your settings)");
				logger.info("Note: Run 'ck init' again to sync MCP config changes.");
				break;
			case "skipped":
				logger.info("Gemini MCP config already configured.");
				break;
		}
	} else {
		logger.warning(`Gemini MCP setup incomplete: ${result.error}`);
		if (options.isGlobal) {
			logger.info(
				"Manual setup: mkdir -p ~/.gemini && ln -sf ~/.claude/.mcp.json ~/.gemini/settings.json",
			);
		} else {
			logger.info("Manual setup: mkdir -p .gemini && ln -sf ../.mcp.json .gemini/settings.json");
		}
	}
}
