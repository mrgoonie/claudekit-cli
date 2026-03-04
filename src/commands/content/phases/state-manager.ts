/**
 * State manager for the content daemon.
 * Loads and persists ContentConfig and ContentState to/from the
 * project-level .ck.json file under the "content" key.
 * All writes use an atomic tmp→rename pattern to avoid corruption.
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type ContentConfig,
	ContentConfigSchema,
	type ContentState,
	ContentStateSchema,
} from "../types.js";

const CK_CONFIG_FILE = ".ck.json";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Load content config from <projectDir>/.ck.json (content key).
 * Returns schema defaults when the file is absent or malformed.
 */
export async function loadContentConfig(projectDir: string): Promise<ContentConfig> {
	const configPath = join(projectDir, CK_CONFIG_FILE);
	try {
		const raw = await readFile(configPath, "utf-8");
		const json = JSON.parse(raw);
		return ContentConfigSchema.parse(json.content ?? {});
	} catch {
		return ContentConfigSchema.parse({});
	}
}

/**
 * Save content config to <projectDir>/.ck.json, preserving all other keys.
 * Uses atomic write (tmp → rename).
 */
export async function saveContentConfig(projectDir: string, config: ContentConfig): Promise<void> {
	const configPath = join(projectDir, CK_CONFIG_FILE);
	const json = await readJsonSafe(configPath);
	// Replace the full content block (state is nested inside config by loadContentState)
	json.content = { ...(json.content as Record<string, unknown> | undefined), ...config };
	await atomicWrite(configPath, json);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Load content runtime state from <projectDir>/.ck.json (content.state key).
 * Returns schema defaults when absent.
 */
export async function loadContentState(projectDir: string): Promise<ContentState> {
	const configPath = join(projectDir, CK_CONFIG_FILE);
	try {
		const raw = await readFile(configPath, "utf-8");
		const json = JSON.parse(raw);
		const contentBlock = json.content ?? {};
		return ContentStateSchema.parse((contentBlock as Record<string, unknown>).state ?? {});
	} catch {
		return ContentStateSchema.parse({});
	}
}

/**
 * Persist content runtime state to <projectDir>/.ck.json.
 * - Caps processedEvents array to the last 1 000 entries to prevent unbounded growth.
 * - Validates via Zod before writing.
 * - Uses atomic write (tmp → rename).
 */
export async function saveContentState(projectDir: string, state: ContentState): Promise<void> {
	const configPath = join(projectDir, CK_CONFIG_FILE);

	// Cap processedEvents to prevent unbounded growth
	const cappedState: ContentState = {
		...state,
		processedEvents: state.processedEvents.slice(-1000),
	};

	// Validate before touching disk
	ContentStateSchema.parse(cappedState);

	const json = await readJsonSafe(configPath);

	if (!json.content || typeof json.content !== "object") {
		json.content = {};
	}
	(json.content as Record<string, unknown>).state = cappedState;

	await atomicWrite(configPath, json);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read and parse JSON from path; returns empty object on any error. */
async function readJsonSafe(filePath: string): Promise<Record<string, unknown>> {
	try {
		const raw = await readFile(filePath, "utf-8");
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return {};
	}
}

/** Write JSON to a .tmp file then rename — prevents partial-write corruption. */
async function atomicWrite(filePath: string, data: Record<string, unknown>): Promise<void> {
	const tmpPath = `${filePath}.tmp`;
	await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
	await rename(tmpPath, filePath);
}
