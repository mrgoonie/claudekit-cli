/**
 * Pure transform: Claude Code hooks → Codex-compatible hooks.
 *
 * Takes a Claude Code HooksSection, a CodexCapabilities record, and an optional
 * path-rewrite map, then returns a Codex-safe HooksSection with:
 *   - Unsupported events dropped (SubagentStart, SubagentStop, etc.)
 *   - Unsupported matchers filtered (SessionStart only allows startup|resume)
 *   - additionalContext NOT emitted here — that's the wrapper's job at runtime
 *   - command paths optionally rewritten from source dir → wrapper dir
 *   - permissionDecision values scrubbed to only "deny" (Codex only supports deny)
 *
 * This function is pure (no I/O). All side-effects live in the caller.
 */
import type { CodexCapabilities } from "../codex-capabilities.js";

/** A single hook entry as used in Claude Code settings.json / Codex hooks.json */
export interface HookEntry {
	type: string;
	command: string;
	timeout?: number;
	/** PreToolUse only: permission decision */
	permissionDecision?: string;
	/** decision field (legacy alias for permissionDecision) */
	decision?: string;
	/** Runtime-added by hooks — stripped from PreToolUse/PermissionRequest output */
	additionalContext?: string;
	[key: string]: unknown;
}

/** A hook group: optional matcher + array of hook entries */
export interface HookGroup {
	matcher?: string;
	hooks: HookEntry[];
}

/** The full hooks section: event name → groups */
export type HooksSection = Record<string, HookGroup[]>;

/** Path rewrite: source hooks dir → target wrapper dir */
export interface PathRewriteMap {
	sourceDir: string;
	targetDir: string;
}

/**
 * Transform a Claude Code HooksSection to a Codex-compatible one.
 *
 * Steps (in order):
 * 1. Drop events not listed as supported in the capability table (e.g. SubagentStart, SubagentStop)
 * 2. Filter groups by allowed matchers per event
 * 3. Scrub permissionDecision / decision to only allowed values
 * 4. Rewrite command paths if pathRewrite is provided
 * 5. Drop empty groups / events after filtering
 */
export function convertClaudeHooksToCodex(
	sourceHooks: HooksSection,
	capabilities: CodexCapabilities,
	pathRewrite?: PathRewriteMap,
): HooksSection {
	const result: HooksSection = {};

	for (const [event, groups] of Object.entries(sourceHooks)) {
		// Step 1: Drop events not supported per capability table.
		// The capability table is the single source of truth — events absent from the
		// table (e.g. SubagentStart, SubagentStop, Notification, PreCompact) are
		// implicitly unsupported and will be dropped here.
		const eventCaps = capabilities.events[event];
		if (!eventCaps?.supported) continue;

		// Step 2: Filter groups by allowed matchers
		const filteredGroups = filterGroupsByMatcher(groups, event, capabilities);

		// Step 3: Scrub each hook entry
		const scrubbedGroups = filteredGroups.map((group) => ({
			...group,
			hooks: group.hooks.map((entry) => scrubHookEntry(entry, event, capabilities, pathRewrite)),
		}));

		// Step 5: Drop empty groups
		const nonEmptyGroups = scrubbedGroups.filter((g) => g.hooks.length > 0);
		if (nonEmptyGroups.length > 0) {
			result[event] = nonEmptyGroups;
		}
	}

	return result;
}

/**
 * Filter hook groups to only those with matchers allowed by Codex for this event.
 * Groups with no matcher (undefined) are preserved unconditionally.
 * Groups with matchers are filtered against allowedMatchers if the event has restrictions.
 */
function filterGroupsByMatcher(
	groups: HookGroup[],
	event: string,
	capabilities: CodexCapabilities,
): HookGroup[] {
	const eventCaps = capabilities.events[event];
	if (!eventCaps) return [];

	const allowedMatchers = eventCaps.allowedMatchers;
	if (!allowedMatchers) {
		// No restriction — all groups pass
		return groups;
	}

	const allowedSet = new Set(allowedMatchers);

	return groups.filter((group) => {
		if (!group.matcher) {
			// No matcher — allow through (wildcard semantics)
			return true;
		}
		// For SessionStart: only startup|resume matchers are valid
		// For Pre/PostToolUse: only Bash is valid
		// Matcher may be pipe-separated (e.g. "startup|resume") — keep if ANY part matches
		const parts = group.matcher.split("|").map((p) => p.trim());
		return parts.some((part) => allowedSet.has(part));
	});
}

/**
 * Scrub a single hook entry:
 * - Rewrite command path if pathRewrite provided
 * - Strip permissionDecision/decision to only allowed values
 * - Remove additionalContext field entirely (wrapper handles this at runtime)
 */
function scrubHookEntry(
	entry: HookEntry,
	event: string,
	capabilities: CodexCapabilities,
	pathRewrite?: PathRewriteMap,
): HookEntry {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { additionalContext: _stripped, ...rest } = entry;
	const scrubbed: HookEntry = { ...rest };

	// Rewrite command path to point at wrapper
	if (pathRewrite) {
		scrubbed.command = rewriteCommandPath(scrubbed.command, pathRewrite);
	}

	// Scrub permissionDecision / decision to only allowed values
	const eventCaps = capabilities.events[event];
	if (eventCaps?.permissionDecisionValues) {
		const allowed = new Set(eventCaps.permissionDecisionValues);
		if (scrubbed.permissionDecision && !allowed.has(scrubbed.permissionDecision)) {
			scrubbed.permissionDecision = undefined;
		}
		if (scrubbed.decision && !allowed.has(scrubbed.decision)) {
			scrubbed.decision = undefined;
		}
	}

	return scrubbed;
}

/**
 * Rewrite a hook command string: replace sourceDir occurrences with targetDir.
 * Handles both quoted and unquoted paths. Appends trailing slash to prevent
 * partial matches (e.g. .claude/hooks-extra vs .claude/hooks).
 */
export function rewriteCommandPath(command: string, pathRewrite: PathRewriteMap): string {
	const src = pathRewrite.sourceDir.endsWith("/")
		? pathRewrite.sourceDir
		: `${pathRewrite.sourceDir}/`;
	const tgt = pathRewrite.targetDir.endsWith("/")
		? pathRewrite.targetDir
		: `${pathRewrite.targetDir}/`;
	// Short-circuit when source and target are identical (no-op rewrite)
	if (src === tgt) return command;
	return command.replaceAll(src, tgt);
}
