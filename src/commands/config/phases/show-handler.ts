/**
 * Handler for `ck config` (show) command
 */

import { ConfigManager } from "@/domains/config/index.js";
import type { ConfigCommandOptions } from "../types.js";

export async function handleShow(options: ConfigCommandOptions): Promise<void> {
	const { global: globalOnly, local: localOnly, json } = options;

	let config: Record<string, unknown>;
	let label: string;

	if (globalOnly) {
		ConfigManager.setGlobalFlag(true);
		config = await ConfigManager.load();
		label = "Global config";
	} else if (localOnly) {
		const projectDir = process.cwd();
		const projectConfig = await ConfigManager.loadProjectConfig(projectDir, false);
		config = projectConfig ? { paths: projectConfig } : {};
		label = "Local config";
	} else {
		// Merged: global + local
		ConfigManager.setGlobalFlag(true);
		const globalConfig = await ConfigManager.load();
		const localConfig = await ConfigManager.loadProjectConfig(process.cwd(), false);
		config = deepMerge(globalConfig, localConfig ? { paths: localConfig } : {});
		label = "Merged config";
	}

	if (json) {
		console.log(JSON.stringify(config, null, 2));
	} else {
		console.log(`\n${label}:\n`);
		console.log(formatConfig(config));
	}
}

function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...target };
	for (const key of Object.keys(source)) {
		const sourceVal = source[key];
		if (sourceVal && typeof sourceVal === "object" && !Array.isArray(sourceVal)) {
			result[key] = deepMerge(
				(result[key] as Record<string, unknown>) || {},
				sourceVal as Record<string, unknown>,
			);
		} else {
			result[key] = sourceVal;
		}
	}
	return result;
}

function formatConfig(config: Record<string, unknown>): string {
	return JSON.stringify(config, null, 2);
}
