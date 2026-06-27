/**
 * Antigravity (agy) CLI MCP Configuration Linker - Facade
 *
 * Enables the Antigravity CLI to use the same MCP servers as Claude Code by
 * pointing agy's mcp_config.json at your Claude `.mcp.json`.
 */

import { resolve } from "node:path";
import { logger } from "@/shared/logger.js";
import {
	addAgyToGitignore,
	createNewSettingsWithMerge,
	mergeAgySettings,
} from "./agy-mcp/config-manager.js";
import { createSymlink } from "./agy-mcp/linker-core.js";
import type { AgyLinkOptions, AgyLinkResult } from "./agy-mcp/linker-core.js";
import {
	checkExistingAgyConfig,
	findMcpConfigPath,
	getAgyMcpConfigPath,
} from "./agy-mcp/validation.js";

// Re-exports
export type { AgyLinkOptions, AgyLinkResult } from "./agy-mcp/linker-core.js";
export { addAgyToGitignore } from "./agy-mcp/config-manager.js";
export {
	checkExistingAgyConfig,
	findMcpConfigPath,
	getAgyMcpConfigPath,
} from "./agy-mcp/validation.js";

/**
 * Setup Antigravity (agy) CLI MCP integration
 */
export async function linkAgyMcpConfig(
	projectDir: string,
	options: AgyLinkOptions = {},
): Promise<AgyLinkResult> {
	const { skipGitignore = false, isGlobal = false } = options;
	const resolvedProjectDir = resolve(projectDir);
	const agyConfigPath = getAgyMcpConfigPath(resolvedProjectDir, isGlobal);

	const mcpConfigPath = findMcpConfigPath(resolvedProjectDir);
	if (!mcpConfigPath) {
		return {
			success: false,
			method: "symlink",
			error: "No MCP config found. Create .mcp.json or ~/.claude/.mcp.json first.",
		};
	}

	const existing = checkExistingAgyConfig(resolvedProjectDir, isGlobal);
	let result: AgyLinkResult;

	if (!existing.exists) {
		result = await createSymlink(mcpConfigPath, agyConfigPath, resolvedProjectDir, isGlobal);
		if (!result.success && process.platform === "win32") {
			logger.debug("Symlink failed on Windows, falling back to merge");
			result = await createNewSettingsWithMerge(agyConfigPath, mcpConfigPath);
		}
	} else if (existing.isSymlink) {
		result = {
			success: true,
			method: "skipped",
			targetPath: existing.currentTarget,
			agyConfigPath,
		};
	} else {
		result = await mergeAgySettings(agyConfigPath, mcpConfigPath);
	}

	if (result.success && !skipGitignore && !isGlobal) {
		await addAgyToGitignore(resolvedProjectDir);
	}

	return result;
}

/**
 * Process agy MCP linking with user feedback
 */
export async function processAgyMcpLinking(
	projectDir: string,
	options: AgyLinkOptions = {},
): Promise<void> {
	logger.info("Setting up Antigravity (agy) CLI MCP integration...");

	const result = await linkAgyMcpConfig(projectDir, options);
	const configPath =
		result.agyConfigPath ||
		(options.isGlobal ? "~/.gemini/config/mcp_config.json" : ".agents/mcp_config.json");

	if (result.success) {
		if (result.method === "symlink") {
			logger.success(`agy MCP linked: ${configPath} → ${result.targetPath}`);
			logger.info("MCP servers will auto-sync with your Claude config.");
		} else if (result.method === "merge") {
			logger.success("agy MCP config updated (merged mcpServers, preserved your settings)");
			logger.info("Note: Run 'ck init' again to sync MCP config changes.");
		} else {
			logger.info("agy MCP config already configured.");
		}
	} else {
		logger.warning(`agy MCP setup incomplete: ${result.error}`);
		const cmd = options.isGlobal
			? "mkdir -p ~/.gemini/config && ln -sf ~/.claude/.mcp.json ~/.gemini/config/mcp_config.json"
			: "mkdir -p .agents && ln -sf ../.mcp.json .agents/mcp_config.json";
		logger.info(`Manual setup: ${cmd}`);
	}
}
