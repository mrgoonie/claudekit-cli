/**
 * Handler for `ck config set <key> <value>` command
 *
 * Per validation: prompts interactively for scope when neither --local nor --global is provided.
 */

import { ConfigManager } from "@/domains/config/index.js";
import { logger } from "@/shared/logger.js";
import * as prompts from "@clack/prompts";
import type { ConfigCommandOptions } from "../types.js";

export async function handleSet(
	key: string,
	value: string,
	options: ConfigCommandOptions,
): Promise<void> {
	const { global: globalOnly, local: localOnly } = options;

	// Parse value (try JSON first, then string)
	let parsedValue: unknown;
	try {
		parsedValue = JSON.parse(value);
	} catch {
		parsedValue = value;
	}

	// Determine scope
	let scope: "global" | "local";

	if (globalOnly) {
		scope = "global";
	} else if (localOnly) {
		scope = "local";
	} else {
		// Interactive prompt for scope
		const selectedScope = await prompts.select({
			message: "Where do you want to save this setting?",
			options: [
				{ value: "local", label: "Local (project)", hint: ".claude/.ck.json" },
				{ value: "global", label: "Global (user)", hint: "~/.claudekit/config.json" },
			],
		});

		if (prompts.isCancel(selectedScope)) {
			prompts.cancel("Operation cancelled.");
			process.exitCode = 1;
			return;
		}

		scope = selectedScope as "global" | "local";
	}

	// Save based on scope
	if (scope === "global") {
		ConfigManager.setGlobalFlag(true);
		await ConfigManager.set(key, parsedValue);
		logger.success(`Set ${key} = ${JSON.stringify(parsedValue)} (global)`);
	} else {
		const projectDir = process.cwd();
		const existing = (await ConfigManager.loadProjectConfig(projectDir, false)) || {};
		setNestedValue(existing, key, parsedValue);
		await ConfigManager.saveProjectConfig(projectDir, existing, false);
		logger.success(`Set ${key} = ${JSON.stringify(parsedValue)} (local)`);
	}
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
	const keys = path.split(".");
	let current: Record<string, unknown> = obj;

	for (let i = 0; i < keys.length - 1; i++) {
		const k = keys[i];
		if (!(k in current) || typeof current[k] !== "object") {
			current[k] = {};
		}
		current = current[k] as Record<string, unknown>;
	}

	current[keys[keys.length - 1]] = value;
}
