/**
 * Gemini CLI MCP Configuration Linker - Facade
 *
 * Enables Gemini CLI to use the same MCP servers as Claude Code.
 */

import { resolve } from "node:path";
import { logger } from "@/shared/logger.js";
import {
	addGeminiToGitignore,
	createNewSettingsWithMerge,
	mergeGeminiSettings,
} from "./gemini-mcp/config-manager.js";
import { createSymlink } from "./gemini-mcp/linker-core.js";
import type { GeminiLinkOptions, GeminiLinkResult } from "./gemini-mcp/linker-core.js";
import {
	checkExistingGeminiConfig,
	findMcpConfigPath,
	getGeminiSettingsPath,
} from "./gemini-mcp/validation.js";

// Re-exports
export type { GeminiLinkOptions, GeminiLinkResult } from "./gemini-mcp/linker-core.js";
export { addGeminiToGitignore } from "./gemini-mcp/config-manager.js";
export {
	checkExistingGeminiConfig,
	findMcpConfigPath,
	getGeminiSettingsPath,
} from "./gemini-mcp/validation.js";

/**
 * Setup Gemini CLI MCP integration
 */
export async function linkGeminiMcpConfig(
	projectDir: string,
	options: GeminiLinkOptions = {},
): Promise<GeminiLinkResult> {
	const { skipGitignore = false, isGlobal = false } = options;
	const resolvedProjectDir = resolve(projectDir);
	const geminiSettingsPath = getGeminiSettingsPath(resolvedProjectDir, isGlobal);

	const mcpConfigPath = findMcpConfigPath(resolvedProjectDir);
	if (!mcpConfigPath) {
		return {
			success: false,
			method: "symlink",
			error: "No MCP config found. Create .mcp.json or ~/.claude/.mcp.json first.",
		};
	}

	const existing = checkExistingGeminiConfig(resolvedProjectDir, isGlobal);
	let result: GeminiLinkResult;

	if (!existing.exists) {
		result = await createSymlink(mcpConfigPath, geminiSettingsPath, resolvedProjectDir, isGlobal);
		if (!result.success && process.platform === "win32") {
			logger.debug("Symlink failed on Windows, falling back to merge");
			result = await createNewSettingsWithMerge(geminiSettingsPath, mcpConfigPath);
		}
	} else if (existing.isSymlink) {
		result = {
			success: true,
			method: "skipped",
			targetPath: existing.currentTarget,
			geminiSettingsPath,
		};
	} else {
		result = await mergeGeminiSettings(geminiSettingsPath, mcpConfigPath);
	}

	if (result.success && !skipGitignore && !isGlobal) {
		await addGeminiToGitignore(resolvedProjectDir);
	}

	return result;
}

/**
 * Process Gemini MCP linking with user feedback
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
		if (result.method === "symlink") {
			logger.success(`Gemini MCP linked: ${settingsPath} → ${result.targetPath}`);
			logger.info("MCP servers will auto-sync with your Claude config.");
		} else if (result.method === "merge") {
			logger.success("Gemini MCP config updated (merged mcpServers, preserved your settings)");
			logger.info("Note: Run 'ck init' again to sync MCP config changes.");
		} else {
			logger.info("Gemini MCP config already configured.");
		}
	} else {
		logger.warning(`Gemini MCP setup incomplete: ${result.error}`);
		const cmd = options.isGlobal
			? "mkdir -p ~/.gemini && ln -sf ~/.claude/.mcp.json ~/.gemini/settings.json"
			: "mkdir -p .gemini && ln -sf ../.mcp.json .gemini/settings.json";
		logger.info(`Manual setup: ${cmd}`);
	}
}
