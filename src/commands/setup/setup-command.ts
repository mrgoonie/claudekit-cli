/**
 * Setup command orchestrator
 * Guides users through ClaudeKit setup: preflight checks, environment config, optional packages, and kit installation
 */

import { PathResolver } from "@/shared/path-resolver.js";
import * as clack from "@clack/prompts";
import {
	handleEnvironmentConfig,
	handleKitSelection,
	handleOptionalPackages,
	handlePreflightCheck,
} from "./phases/index.js";
import type { SetupContext, SetupOptions } from "./types.js";

/**
 * Create initial setup context
 */
function createContext(options: SetupOptions): SetupContext {
	const targetDir = options.global ? PathResolver.getGlobalKitDir() : options.dir || process.cwd();

	return {
		targetDir,
		options,
		cancelled: false,
		envConfigured: false,
		packagesInstalled: [],
	};
}

/**
 * Main setup command orchestrator
 * Runs all phases in sequence
 */
export async function setupCommand(options: SetupOptions): Promise<void> {
	clack.intro("ClaudeKit Setup Wizard");

	// Create context
	let ctx = createContext(options);

	// Phase 1: Preflight checks
	ctx = await handlePreflightCheck(ctx);
	if (ctx.cancelled) {
		clack.outro("Setup cancelled");
		return;
	}

	// Phase 2: Environment configuration
	ctx = await handleEnvironmentConfig(ctx);
	if (ctx.cancelled) {
		clack.outro("Setup cancelled");
		return;
	}

	// Phase 3: Optional packages
	ctx = await handleOptionalPackages(ctx);
	if (ctx.cancelled) {
		clack.outro("Setup cancelled");
		return;
	}

	// Phase 4: Kit selection and installation
	ctx = await handleKitSelection(ctx);
	if (ctx.cancelled) {
		clack.outro("Setup incomplete");
		return;
	}

	// Success message
	clack.outro("Setup complete! ClaudeKit is ready to use.");

	if (ctx.packagesInstalled.length > 0) {
		clack.log.success(`Installed packages: ${ctx.packagesInstalled.join(", ")}`);
	}
}
