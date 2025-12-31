/**
 * Gemini MCP validation utilities
 */

import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "@/shared/logger.js";

/**
 * Get the global MCP config path (~/.claude/.mcp.json)
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
