/**
 * Environment configuration phase for setup command
 * Reuses existing setup wizard for API key configuration
 */

import { runSetupWizard } from "@/domains/installation/setup-wizard.js";
import * as clack from "@clack/prompts";
import type { SetupContext } from "../types.js";

/**
 * Configure environment variables (API keys, etc)
 * Returns updated context with envConfigured flag
 */
export async function handleEnvironmentConfig(ctx: SetupContext): Promise<SetupContext> {
	clack.log.step("Configuring environment...");

	const setupCompleted = await runSetupWizard({
		targetDir: ctx.targetDir,
		isGlobal: ctx.options.global,
	});

	if (!setupCompleted) {
		return { ...ctx, cancelled: true };
	}

	return {
		...ctx,
		envConfigured: true,
	};
}
