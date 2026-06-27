/**
 * Antigravity (agy) MCP validation utilities
 *
 * The Antigravity CLI reads MCP servers from a dedicated `mcp_config.json` file
 * (same `{ "mcpServers": {...} }` shape as Claude Code's `.mcp.json`):
 *   - Workspace: <projectDir>/.agents/mcp_config.json
 *   - Global:    ~/.gemini/config/mcp_config.json
 */

import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

/**
 * Get the global MCP config path (~/.claude/.mcp.json) — the source of truth
 * that agy's config is linked/merged from.
 */
export function getGlobalMcpConfigPath(): string {
	return join(homedir(), ".claude", ".mcp.json");
}

/**
 * Get the local MCP config path (./.mcp.json relative to project dir)
 */
export function getLocalMcpConfigPath(projectDir: string): string {
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
 * Get the Antigravity (agy) MCP config path based on install type.
 * - Global: ~/.gemini/config/mcp_config.json (agy's shared global MCP config)
 * - Local:  <projectDir>/.agents/mcp_config.json (agy's workspace MCP config)
 */
export function getAgyMcpConfigPath(projectDir: string, isGlobal: boolean): string {
	if (isGlobal) {
		return join(homedir(), ".gemini", "config", "mcp_config.json");
	}
	return join(projectDir, ".agents", "mcp_config.json");
}

/**
 * Check if agy's mcp_config.json already exists.
 */
export function checkExistingAgyConfig(
	projectDir: string,
	isGlobal = false,
): {
	exists: boolean;
	isSymlink: boolean;
	currentTarget?: string;
	settingsPath: string;
} {
	const agyConfigPath = getAgyMcpConfigPath(projectDir, isGlobal);

	if (!existsSync(agyConfigPath)) {
		return { exists: false, isSymlink: false, settingsPath: agyConfigPath };
	}

	try {
		const stats = lstatSync(agyConfigPath);
		if (stats.isSymbolicLink()) {
			const target = readlinkSync(agyConfigPath);
			return {
				exists: true,
				isSymlink: true,
				currentTarget: target,
				settingsPath: agyConfigPath,
			};
		}
		return { exists: true, isSymlink: false, settingsPath: agyConfigPath };
	} catch {
		return { exists: true, isSymlink: false, settingsPath: agyConfigPath };
	}
}
