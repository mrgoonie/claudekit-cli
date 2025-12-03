/**
 * DEPRECATED: diagnose command
 *
 * This command is deprecated and will be removed in a future version.
 * Use `ck doctor` instead for comprehensive health checks.
 */

import type { KitType } from "../types.js";
import { logger } from "../utils/logger.js";
import { doctorCommand } from "./doctor.js";

interface DiagnoseOptions {
	kit?: KitType;
}

/**
 * Deprecated diagnose command - forwards to doctorCommand
 */
export async function diagnoseCommand(options: DiagnoseOptions = {}): Promise<void> {
	// Show deprecation warning
	logger.info("");
	logger.warning("'ck diagnose' is deprecated and will be removed in a future version.");
	logger.info("Use 'ck doctor' instead for comprehensive health checks.");
	logger.info("");

	// Log to verbose
	logger.verbose("Forwarding diagnose command to doctor", { options });

	// Small delay for user to see warning
	await new Promise((resolve) => setTimeout(resolve, 1500));

	// Forward to doctor command
	// Note: diagnose checks are now part of doctor's auth checker
	await doctorCommand({
		global: false, // diagnose checked both local and global
		report: false,
		fix: false,
		checkOnly: false,
		json: false,
	});
}
