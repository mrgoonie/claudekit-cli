/**
 * Watch state manager — reads/writes watch config and state from .ck.json
 * Uses atomic writes (temp+rename) to prevent corruption during overnight runs
 */

import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CkConfigManager } from "@/domains/config/ck-config-manager.js";
import { atomicWriteFile } from "@/domains/config/merger/file-io.js";
import { logger } from "@/shared/logger.js";
import {
	type WatchConfig,
	WatchConfigSchema,
	type WatchState,
	WatchStateSchema,
} from "../types.js";
import { migrateProcessedIssues } from "./state-cleanup.js";

const PROCESSED_ISSUES_CAP = 500;

/**
 * Read raw .ck.json and extract watch section
 */
async function readCkJson(projectDir: string): Promise<Record<string, unknown>> {
	const configPath = CkConfigManager.getProjectConfigPath(projectDir);
	try {
		if (!existsSync(configPath)) return {};
		const content = await readFile(configPath, "utf-8");
		return JSON.parse(content) as Record<string, unknown>;
	} catch (error) {
		logger.warning(
			`Failed to parse .ck.json: ${error instanceof Error ? error.message : "Unknown"}`,
		);
		return {};
	}
}

/**
 * Load watch config from .ck.json (with defaults for missing fields)
 */
export async function loadWatchConfig(projectDir: string): Promise<WatchConfig> {
	const raw = await readCkJson(projectDir);
	const watchRaw = (raw.watch ?? {}) as Record<string, unknown>;
	try {
		return WatchConfigSchema.parse(watchRaw);
	} catch {
		logger.warning("Invalid watch config in .ck.json, using defaults");
		return WatchConfigSchema.parse({});
	}
}

/**
 * Load watch state from .ck.json (subset of watch config)
 */
export async function loadWatchState(projectDir: string): Promise<WatchState> {
	const config = await loadWatchConfig(projectDir);
	return config.state;
}

/**
 * Save watch state back to .ck.json atomically
 * Preserves all other keys in the file; only updates watch.state
 */
export async function saveWatchState(projectDir: string, state: WatchState): Promise<void> {
	const configPath = CkConfigManager.getProjectConfigPath(projectDir);
	const configDir = dirname(configPath);

	// Ensure directory exists
	if (!existsSync(configDir)) {
		await mkdir(configDir, { recursive: true });
	}

	// Read full file to preserve other keys
	const raw = await readCkJson(projectDir);
	const watchRaw = (raw.watch ?? {}) as Record<string, unknown>;

	// Cap processedIssues to prevent unbounded growth (migrate to timestamped format first)
	const cappedState: WatchState = {
		...state,
		processedIssues: migrateProcessedIssues(state.processedIssues).slice(-PROCESSED_ISSUES_CAP),
	};

	// Validate before persisting
	const validated = WatchStateSchema.parse(cappedState);

	// Update watch.state subtree
	watchRaw.state = validated;
	raw.watch = watchRaw;

	// Atomic write
	await atomicWriteFile(configPath, JSON.stringify(raw, null, 2));
	logger.verbose("Watch state saved");
}
