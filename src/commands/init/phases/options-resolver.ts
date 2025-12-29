/**
 * Options validation and mode detection phase
 * Handles CLI option parsing, global flag setup, and non-interactive detection
 */

import { ConfigManager } from "@/domains/config/config-manager.js";
import { logger } from "@/shared/logger.js";
import { UpdateCommandOptionsSchema } from "@/types";
import type { InitContext, ValidatedOptions } from "../types.js";

/**
 * Resolve and validate CLI options
 * Sets up global flag, detects non-interactive mode
 */
export async function resolveOptions(ctx: InitContext): Promise<InitContext> {
	// Check if --dir was explicitly provided (before schema applies defaults)
	const explicitDir = ctx.rawOptions.dir !== undefined;

	// Validate and parse options
	const parsed = UpdateCommandOptionsSchema.parse(ctx.rawOptions);

	const validOptions: ValidatedOptions = {
		kit: parsed.kit,
		dir: parsed.dir,
		release: parsed.release,
		beta: parsed.beta ?? false,
		global: parsed.global ?? false,
		yes: parsed.yes ?? false,
		fresh: parsed.fresh ?? false,
		refresh: parsed.refresh ?? false,
		exclude: parsed.exclude ?? [],
		only: parsed.only ?? [],
		docsDir: parsed.docsDir,
		plansDir: parsed.plansDir,
		installSkills: parsed.installSkills ?? false,
		withSudo: parsed.withSudo ?? false,
		skipSetup: parsed.skipSetup ?? false,
		forceOverwrite: parsed.forceOverwrite ?? false,
		forceOverwriteSettings: parsed.forceOverwriteSettings ?? false,
		dryRun: parsed.dryRun ?? false,
		prefix: parsed.prefix ?? false,
		sync: parsed.sync ?? false,
		useGit: parsed.useGit ?? false,
	};

	// Set global flag for ConfigManager
	ConfigManager.setGlobalFlag(validOptions.global);

	// Log installation mode
	if (validOptions.global) {
		logger.info("Global mode enabled - using platform-specific user configuration");
	}

	// Validate --use-git requires --release (can't list versions without API auth)
	if (validOptions.useGit && !validOptions.release) {
		throw new Error(
			"--use-git requires --release <tag> to specify the version.\n\n" +
				"Git clone mode cannot list versions without GitHub API access.\n" +
				"Example: ck init --use-git --release v2.1.0",
		);
	}

	// Warn if --use-git + --beta (beta flag has no effect with explicit release)
	if (validOptions.useGit && validOptions.beta) {
		logger.warning(
			"--beta flag is ignored when using --use-git (version already specified via --release)",
		);
	}

	// Validate --fresh + --sync are mutually exclusive
	if (validOptions.fresh && validOptions.sync) {
		throw new Error(
			"--fresh and --sync are mutually exclusive.\n\n" +
				"--fresh: Removes all ClaudeKit files and reinstalls from scratch\n" +
				"--sync: Updates to match the version in metadata.json\n\n" +
				"Choose one approach.",
		);
	}

	// Note: --sync + --use-git IS allowed
	// --sync reads version from local metadata.json, then git clone downloads it
	// This supports users who want to reinstall same version but only have git auth

	// Detect non-interactive mode (--yes flag, no TTY, or CI environment)
	const isNonInteractive =
		validOptions.yes ||
		!process.stdin.isTTY ||
		process.env.CI === "true" ||
		process.env.NON_INTERACTIVE === "true";

	// Log if using --yes flag for clarity
	if (validOptions.yes) {
		logger.info("Running in non-interactive mode (--yes flag)");
	}

	return {
		...ctx,
		options: validOptions,
		explicitDir,
		isNonInteractive,
	};
}
