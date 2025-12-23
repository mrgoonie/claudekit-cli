/**
 * Read Claude settings from ~/.claude/settings.json and ~/.claude/glm.settings.json
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

export interface GlmSettings {
	env?: {
		ANTHROPIC_MODEL?: string;
	};
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

export async function readGlmSettings(): Promise<{ model?: string } | null> {
	const glmPath = join(claudeDir, "glm.settings.json");
	try {
		if (!existsSync(glmPath)) return null;
		const content = await readFile(glmPath, "utf-8");
		const data = JSON.parse(content) as GlmSettings;
		return { model: data.env?.ANTHROPIC_MODEL };
	} catch {
		return null;
	}
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
