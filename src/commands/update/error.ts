/**
 * CLI Update Error
 * Domain error class for update command failures.
 */

import { ClaudeKitError } from "@/types";

/**
 * Thrown when the CLI update command fails.
 * Caught and re-thrown by the orchestrator to surface user-facing messages.
 */
export class CliUpdateError extends ClaudeKitError {
	constructor(message: string) {
		super(message, "CLI_UPDATE_ERROR");
		this.name = "CliUpdateError";
	}
}
