/**
 * Gemini MCP Core Linking Logic
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

import { existsSync } from "node:fs";
import { mkdir, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "@/shared/logger.js";
import { getGlobalMcpConfigPath } from "./validation.js";

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
 * Create symlink with Windows fallback to merge
 * - Local installs: Use relative path (../.mcp.json) for portability
 * - Global installs: Use absolute path to ~/.claude/.mcp.json
 */
export async function createSymlink(
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
