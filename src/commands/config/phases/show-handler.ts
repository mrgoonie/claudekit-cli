/**
 * Handler for `ck config show` command
 * Uses CkConfigManager for correct .ck.json config resolution
 */

import { CkConfigManager } from "@/domains/config/index.js";
import type { ConfigCommandOptions } from "../types.js";

export async function handleShow(options: ConfigCommandOptions): Promise<void> {
	const { global: globalOnly, local: localOnly, json } = options;
	const projectDir = process.cwd();

	// Validate mutually exclusive flags
	if (globalOnly && localOnly) {
		console.error("Cannot use both --global and --local flags together");
		process.exitCode = 1;
		return;
	}

	let config: Record<string, unknown>;
	let label: string;

	if (globalOnly) {
		const scoped = await CkConfigManager.loadScope("global", projectDir);
		config = (scoped as Record<string, unknown>) || {};
		label = "Global config";
	} else if (localOnly) {
		const scoped = await CkConfigManager.loadScope("project", projectDir);
		config = (scoped as Record<string, unknown>) || {};
		label = "Local config";
	} else {
		// Merged: defaults + global + local
		const { config: merged } = await CkConfigManager.loadFull(projectDir);
		config = merged as Record<string, unknown>;
		label = "Merged config";
	}

	if (json) {
		console.log(JSON.stringify(config, null, 2));
	} else {
		console.log(`\n${label}:\n`);
		console.log(JSON.stringify(config, null, 2));
	}
}
