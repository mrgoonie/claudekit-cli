/**
 * Handler for `ck config get <key>` command
 */

import { ConfigManager } from "@/domains/config/index.js";
import type { ConfigCommandOptions } from "../types.js";

export async function handleGet(key: string, options: ConfigCommandOptions): Promise<void> {
	const { global: globalOnly, json } = options;

	let config: Record<string, unknown>;

	if (globalOnly) {
		ConfigManager.setGlobalFlag(true);
		config = await ConfigManager.load();
	} else {
		// Default: merge local over global
		ConfigManager.setGlobalFlag(true);
		const globalConfig = await ConfigManager.load();
		const localConfig = await ConfigManager.loadProjectConfig(process.cwd(), false);
		config = deepMerge(globalConfig, localConfig ? { paths: localConfig } : {});
	}

	const value = getNestedValue(config, key);

	if (value === undefined) {
		console.error(`Key not found: ${key}`);
		process.exitCode = 1;
		return;
	}

	if (json || typeof value === "object") {
		console.log(JSON.stringify(value, null, 2));
	} else {
		console.log(value);
	}
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	return path.split(".").reduce((acc: unknown, key: string) => {
		if (acc && typeof acc === "object" && key in acc) {
			return (acc as Record<string, unknown>)[key];
		}
		return undefined;
	}, obj);
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
