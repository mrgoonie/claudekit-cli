/**
 * Read Claude settings from ~/.claude/settings.json
 * Note: Model is determined at runtime via ANTHROPIC_MODEL env var or claude --model flag
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ClaudeSettings {
	model?: string;
	hooks?: Record<string, { matcher?: string; hooks: unknown[] }[]>;
	permissions?: unknown;
	mcpServers?: Record<string, unknown>;
}

const claudeDir = join(homedir(), ".claude");
const settingsFilename = "settings.json";
const settingsBackupDir = join(claudeDir, ".ck-backups", "settings");

export function getSettingsPath(): string {
	return join(claudeDir, settingsFilename);
}

export async function readSettings(): Promise<ClaudeSettings | null> {
	const settingsPath = getSettingsPath();
	try {
		if (!existsSync(settingsPath)) return null;
		const content = await readFile(settingsPath, "utf-8");
		return JSON.parse(content) as ClaudeSettings;
	} catch {
		return null;
	}
}

function getBackupTimestamp(): string {
	return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

export async function backupAndSaveSettings(
	settings: Record<string, unknown>,
): Promise<{ backupPath: string | null; savedPath: string }> {
	const settingsPath = getSettingsPath();
	await mkdir(claudeDir, { recursive: true });

	let backupPath: string | null = null;
	if (existsSync(settingsPath)) {
		await mkdir(settingsBackupDir, { recursive: true });
		backupPath = join(settingsBackupDir, `${getBackupTimestamp()}-${settingsFilename}`);
		await copyFile(settingsPath, backupPath);
	}

	const tempPath = `${settingsPath}.tmp-${Date.now()}`;
	try {
		await writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
		await rename(tempPath, settingsPath);
		return { backupPath, savedPath: settingsPath };
	} catch (error) {
		await rm(tempPath, { force: true }).catch(() => undefined);
		throw error;
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
