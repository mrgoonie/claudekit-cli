/**
 * Resolve which content types to migrate based on CLI flags and options.
 * Extracted from migrate-command.ts for testability (#404).
 *
 * Truth table (any subset of types can be selected via --X "only" flags
 * or excluded via --skip-X / --no-X flags):
 *   --config / --rules / --hooks                        → only those types
 *   --only-agents / --only-commands / --only-skills      → only those types
 *   --skip-X (any type) → everything except X
 *   (none)              → everything
 *
 * Skip and only flags can combine across different types.
 */

/** Options that affect migration scope */
export interface MigrateScopeOptions {
	agents?: boolean;
	commands?: boolean;
	skills?: boolean;
	config?: boolean;
	rules?: boolean;
	hooks?: boolean;
	skipAgents?: boolean;
	skipCommands?: boolean;
	skipSkills?: boolean;
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

	// Detect explicit CLI flags (only-mode for content type X).
	// Agents/commands/skills use the `--only-*` form to avoid collision with
	// `-a, --agent <agents...>` (the variadic provider list). Config/rules/hooks
	// keep the legacy `--<type>` form for backward compatibility.
	const hasAgentsArg = argSet.has("--only-agents");
	const hasCommandsArg = argSet.has("--only-commands");
	const hasSkillsArg = argSet.has("--only-skills");
	const hasConfigArg = argSet.has("--config");
	const hasRulesArg = argSet.has("--rules");
	const hasHooksArg = argSet.has("--hooks");
	// Skip-mode flags
	const hasNoAgentsArg = argSet.has("--no-agents") || argSet.has("--skip-agents");
	const hasNoCommandsArg = argSet.has("--no-commands") || argSet.has("--skip-commands");
	const hasNoSkillsArg = argSet.has("--no-skills") || argSet.has("--skip-skills");
	const hasNoConfigArg = argSet.has("--no-config") || argSet.has("--skip-config");
	const hasNoRulesArg = argSet.has("--no-rules") || argSet.has("--skip-rules");
	const hasNoHooksArg = argSet.has("--no-hooks") || argSet.has("--skip-hooks");

	// Programmatic fallback (no argv toggles at all):
	// - Legacy: config+rules together still means migrate-everything.
	// - Single-only positives (config / rules / hooks) trigger only-mode.
	// - hooks combined with config/rules also triggers only-mode (existing behavior).
	// New types (agents/commands/skills) are argv-only triggers; programmatic
	// `options.skills = true` does NOT flip into only-mode (kept simple, YAGNI).
	const hasNoToggleArgs =
		!hasAgentsArg &&
		!hasCommandsArg &&
		!hasSkillsArg &&
		!hasConfigArg &&
		!hasRulesArg &&
		!hasHooksArg &&
		!hasNoAgentsArg &&
		!hasNoCommandsArg &&
		!hasNoSkillsArg &&
		!hasNoConfigArg &&
		!hasNoRulesArg &&
		!hasNoHooksArg;
	const fallbackConfigOnly =
		hasNoToggleArgs && options.config === true && options.rules !== true && options.hooks !== true;
	const fallbackRulesOnly =
		hasNoToggleArgs && options.rules === true && options.config !== true && options.hooks !== true;
	const fallbackHooksOnly =
		hasNoToggleArgs && options.hooks === true && options.config !== true && options.rules !== true;
	const fallbackOnlyModeWithHooks =
		hasNoToggleArgs &&
		options.hooks === true &&
		(options.config === true || options.rules === true);

	// "Only" mode: any X-only flag was specified (argv) or programmatic equivalent.
	const hasOnlyFlag =
		hasAgentsArg ||
		hasCommandsArg ||
		hasSkillsArg ||
		hasConfigArg ||
		hasRulesArg ||
		hasHooksArg ||
		fallbackConfigOnly ||
		fallbackRulesOnly ||
		fallbackHooksOnly ||
		fallbackOnlyModeWithHooks;

	// Skip-mode (per type): explicit --skip-X / --no-X / programmatic equivalent.
	const skipAgents = hasNoAgentsArg || options.skipAgents === true || options.agents === false;
	const skipCommands =
		hasNoCommandsArg || options.skipCommands === true || options.commands === false;
	const skipSkills = hasNoSkillsArg || options.skipSkills === true || options.skills === false;
	const skipConfig = hasNoConfigArg || options.skipConfig === true || options.config === false;
	const skipRules = hasNoRulesArg || options.skipRules === true || options.rules === false;
	const skipHooks = hasNoHooksArg || options.skipHooks === true || options.hooks === false;

	// Per-type only-mode triggers (legacy behavior preserved for config/rules/hooks).
	const migrateAgentsOnly = hasAgentsArg;
	const migrateCommandsOnly = hasCommandsArg;
	const migrateSkillsOnly = hasSkillsArg;
	const migrateConfigOnly =
		hasConfigArg || fallbackConfigOnly || (fallbackOnlyModeWithHooks && options.config === true);
	const migrateRulesOnly =
		hasRulesArg || fallbackRulesOnly || (fallbackOnlyModeWithHooks && options.rules === true);
	const migrateHooksOnly = hasHooksArg || fallbackHooksOnly || fallbackOnlyModeWithHooks;

	return {
		agents: hasOnlyFlag ? migrateAgentsOnly && !skipAgents : !skipAgents,
		commands: hasOnlyFlag ? migrateCommandsOnly && !skipCommands : !skipCommands,
		skills: hasOnlyFlag ? migrateSkillsOnly && !skipSkills : !skipSkills,
		config: hasOnlyFlag ? migrateConfigOnly && !skipConfig : !skipConfig,
		rules: hasOnlyFlag ? migrateRulesOnly && !skipRules : !skipRules,
		hooks: hasOnlyFlag ? migrateHooksOnly && !skipHooks : !skipHooks,
	};
}
