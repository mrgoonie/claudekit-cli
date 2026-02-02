/**
 * Handler for `ck config set <key> <value>` command
 * Uses CkConfigManager for correct .ck.json config resolution
 */

import { CkConfigManager } from "@/domains/config/index.js";
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
	let scope: "global" | "project";

	if (globalOnly) {
		scope = "global";
	} else if (localOnly) {
		scope = "project";
	} else {
		// Interactive prompt for scope
		const selectedScope = await prompts.select({
			message: "Where do you want to save this setting?",
			options: [
				{ value: "project", label: "Local (project)", hint: ".claude/.ck.json" },
				{ value: "global", label: "Global (user)", hint: "~/.claude/.ck.json" },
			],
		});

		if (prompts.isCancel(selectedScope)) {
			prompts.cancel("Operation cancelled.");
			process.exitCode = 1;
			return;
		}

		scope = selectedScope as "global" | "project";
	}

	const projectDir = process.cwd();
	await CkConfigManager.updateField(key, parsedValue, scope, projectDir);
	logger.success(
		`Set ${key} = ${JSON.stringify(parsedValue)} (${scope === "project" ? "local" : "global"})`,
	);
}
