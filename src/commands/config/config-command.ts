/**
 * Config command orchestrator - routes to appropriate handler
 */

import { configUICommand } from "./config-ui-command.js";
import { handleGet } from "./phases/get-handler.js";
import { handleSet } from "./phases/set-handler.js";
import { handleShow } from "./phases/show-handler.js";
import type { ConfigCommandOptions, ConfigUIOptions } from "./types.js";

export async function configCommand(
	action: string | undefined,
	keyOrOptions?: string | ConfigCommandOptions,
	valueOrOptions?: string | ConfigCommandOptions,
	options?: ConfigCommandOptions,
): Promise<void> {
	// Route to subcommand
	if (action === "ui") {
		// cac puts flags in the last parameter (options), not in positional args
		const uiOpts = options || (typeof keyOrOptions === "object" ? keyOrOptions : {});
		return configUICommand(uiOpts as ConfigUIOptions);
	}

	if (action === "get" && typeof keyOrOptions === "string") {
		return handleGet(keyOrOptions, options || {});
	}

	if (action === "set" && typeof keyOrOptions === "string") {
		if (typeof valueOrOptions !== "string") {
			console.error("Usage: ck config set <key> <value>");
			process.exitCode = 1;
			return;
		}
		return handleSet(keyOrOptions, valueOrOptions, options || {});
	}

	// Default: show config
	// Handle case where action is one of the flags
	const opts = typeof keyOrOptions === "object" ? keyOrOptions : options || {};
	return handleShow(opts);
}
