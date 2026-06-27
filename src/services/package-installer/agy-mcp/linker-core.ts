/**
 * Antigravity (agy) MCP Core Linking Logic
 *
 * HYBRID APPROACH:
 * - If NO agy mcp_config.json exists → Create symlink to .mcp.json (auto-syncs)
 * - If agy mcp_config.json EXISTS → Selective merge (preserve user keys, inject mcpServers)
 *
 * MCP Config Priority (source of truth):
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
import { isWindows } from "@/shared/environment.js";
import { logger } from "@/shared/logger.js";
import { getGlobalMcpConfigPath } from "./validation.js";

export interface AgyLinkResult {
	success: boolean;
	method: "symlink" | "merge" | "skipped";
	targetPath?: string;
	/** Path to the written/linked agy mcp_config.json. */
	agyConfigPath?: string;
	error?: string;
}

export interface AgyLinkOptions {
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
): Promise<AgyLinkResult> {
	// Ensure parent directory exists
	const linkDir = dirname(linkPath);
	if (!existsSync(linkDir)) {
		await mkdir(linkDir, { recursive: true });
		logger.debug(`Created directory: ${linkDir}`);
	}

	// Determine symlink target based on install type
	let symlinkTarget: string;
	if (isGlobal) {
		// Global: ~/.gemini/config/mcp_config.json → ~/.claude/.mcp.json (absolute path)
		symlinkTarget = getGlobalMcpConfigPath();
	} else {
		// Local: Check if using local or global MCP config
		const localMcpPath = join(projectDir, ".mcp.json");
		const isLocalConfig = targetPath === localMcpPath;
		// From .agents/mcp_config.json, ../.mcp.json points to project root
		symlinkTarget = isLocalConfig ? "../.mcp.json" : targetPath;
	}

	try {
		await symlink(symlinkTarget, linkPath, isWindows() ? "file" : undefined);
		logger.debug(`Created symlink: ${linkPath} → ${symlinkTarget}`);
		return { success: true, method: "symlink", targetPath, agyConfigPath: linkPath };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			success: false,
			method: "symlink",
			error: `Failed to create symlink: ${errorMessage}`,
		};
	}
}
