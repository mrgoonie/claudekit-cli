/**
 * Resolve which content types to migrate based on CLI flags and options.
 * Extracted from migrate-command.ts for testability (#404).
 *
 * Truth table:
 *   --config           → only config (no agents/commands/skills/rules/hooks)
 *   --rules            → only rules
 *   --hooks            → only hooks
 *   --config --rules   → only config AND rules
 *   --skip-config      → everything except config
 *   --skip-rules       → everything except rules
 *   --skip-hooks       → everything except hooks
 *   (none)             → everything
 */

/** Options that affect migration scope */
export interface MigrateScopeOptions {
	config?: boolean;
	rules?: boolean;
	hooks?: boolean;
	skipConfig?: boolean;
	skipRules?: boolean;
	skipHooks?: boolean;
}

/** Resolved migration scope — which content types to include */
export interface MigrationScope {
	agents: boolean;
	commands: boolean;
	skills: boolean;
	config: boolean;
	rules: boolean;
	hooks: boolean;
}

/**
 * Resolve migration scope from CLI argv and parsed options.
 * @param argv - Raw CLI arguments (process.argv.slice(2) or equivalent)
 * @param options - Parsed options from cac
 */
export function resolveMigrationScope(
	argv: string[],
	options: MigrateScopeOptions,
): MigrationScope {
	const argSet = new Set(argv);

	// Detect explicit CLI flags
	const hasConfigArg = argSet.has("--config");
	const hasRulesArg = argSet.has("--rules");
	const hasHooksArg = argSet.has("--hooks");
	const hasNoConfigArg = argSet.has("--no-config") || argSet.has("--skip-config");
	const hasNoRulesArg = argSet.has("--no-rules") || argSet.has("--skip-rules");
	const hasNoHooksArg = argSet.has("--no-hooks") || argSet.has("--skip-hooks");

	// Programmatic fallback: when called without CLI flags (e.g. from web API),
	// allow a single explicit positive toggle via options object
	const hasNoToggleArgs =
		!hasConfigArg &&
		!hasRulesArg &&
		!hasHooksArg &&
		!hasNoConfigArg &&
		!hasNoRulesArg &&
		!hasNoHooksArg;
	const fallbackConfigOnly = hasNoToggleArgs && options.config === true && options.rules !== true;
	const fallbackRulesOnly = hasNoToggleArgs && options.rules === true && options.config !== true;
	const fallbackHooksOnly =
		hasNoToggleArgs &&
		options.hooks === true &&
		options.config !== true &&
		options.rules !== true;

	// "Only" mode: --config and/or --rules were specified → restrict to those types
	const hasOnlyFlag =
		hasConfigArg ||
		hasRulesArg ||
		hasHooksArg ||
		fallbackConfigOnly ||
		fallbackRulesOnly ||
		fallbackHooksOnly;

	// "Skip" mode: --skip-config / --skip-rules / --no-config / --no-rules
	const skipConfig = hasNoConfigArg || options.skipConfig === true || options.config === false;
	const skipRules = hasNoRulesArg || options.skipRules === true || options.rules === false;
	const skipHooks = hasNoHooksArg || options.skipHooks === true || options.hooks === false;

	const migrateConfigOnly = hasConfigArg || fallbackConfigOnly;
	const migrateRulesOnly = hasRulesArg || fallbackRulesOnly;
	const migrateHooksOnly = hasHooksArg || fallbackHooksOnly;

	return {
		agents: !hasOnlyFlag,
		commands: !hasOnlyFlag,
		skills: !hasOnlyFlag,
		config: hasOnlyFlag ? migrateConfigOnly && !skipConfig : !skipConfig,
		rules: hasOnlyFlag ? migrateRulesOnly && !skipRules : !skipRules,
		hooks: hasOnlyFlag ? migrateHooksOnly && !skipHooks : !skipHooks,
	};
}
