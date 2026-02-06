/**
 * Read Claude settings from ~/.claude/settings.json
 * Note: Model is determined at runtime via ANTHROPIC_MODEL env var or claude --model flag
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ClaudeSettings {
	model?: string;
	hooks?: Record<string, { matcher?: string; hooks: unknown[] }[]>;
	permissions?: unknown;
	mcpServers?: Record<string, unknown>;
}

export interface HookDetail {
	event: string;
	command: string;
	enabled: boolean;
}

export interface McpServerDetail {
	name: string;
	command: string;
}

export interface McpConfig {
	mcpServers?: Record<
		string,
		{
			command?: string;
			args?: string[];
			type?: string;
			url?: string;
		}
	>;
}

const claudeDir = join(homedir(), ".claude");

export async function readSettings(): Promise<ClaudeSettings | null> {
	const settingsPath = join(claudeDir, "settings.json");
	try {
		if (!existsSync(settingsPath)) return null;
		const content = await readFile(settingsPath, "utf-8");
		return JSON.parse(content) as ClaudeSettings;
	} catch {
		return null;
	}
}

/**
 * Get the current model from environment variable
 * Claude Code model is determined by: CLI flag > env var > default
 */
export function getCurrentModel(): string | null {
	return process.env.ANTHROPIC_MODEL || null;
}

export function countHooks(settings: ClaudeSettings): number {
	if (!settings.hooks) return 0;
	let count = 0;
	for (const eventHooks of Object.values(settings.hooks)) {
		for (const hookGroup of eventHooks) {
			count += hookGroup.hooks?.length || 0;
		}
	}
	return count;
}

export function countMcpServers(settings: ClaudeSettings): number {
	if (!settings.mcpServers) return 0;
	return Object.keys(settings.mcpServers).length;
}

/**
 * Extract hook details from settings
 */
export function extractHooks(settings: ClaudeSettings): HookDetail[] {
	if (!settings.hooks) return [];

	const hooks: HookDetail[] = [];

	for (const [event, hookGroups] of Object.entries(settings.hooks)) {
		for (const hookGroup of hookGroups) {
			if (Array.isArray(hookGroup.hooks)) {
				for (const hook of hookGroup.hooks) {
					if (hook && typeof hook === "object" && "command" in hook) {
						hooks.push({
							event,
							command: String(hook.command),
							enabled: true, // Hooks in settings.json are enabled by default
						});
					}
				}
			}
		}
	}

	return hooks;
}

/**
 * Read MCP server configuration from ~/.claude/.mcp.json
 */
export async function readMcpServers(): Promise<McpServerDetail[]> {
	const mcpPath = join(claudeDir, ".mcp.json");

	try {
		if (!existsSync(mcpPath)) return [];

		const content = await readFile(mcpPath, "utf-8");
		const config = JSON.parse(content) as McpConfig;

		if (!config.mcpServers) return [];

		return Object.entries(config.mcpServers).map(([name, serverConfig]) => {
			let command = "";

			if (serverConfig.type === "http") {
				command = serverConfig.url || "";
			} else {
				// stdio type or default
				const cmd = serverConfig.command || "";
				const args = serverConfig.args ? ` ${serverConfig.args.join(" ")}` : "";
				command = `${cmd}${args}`;
			}

			return { name, command };
		});
	} catch {
		return [];
	}
}
