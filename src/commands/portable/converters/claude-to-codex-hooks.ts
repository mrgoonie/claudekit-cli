/**
 * Pure transform: Claude Code hooks → Codex-compatible hooks.
 *
 * Takes a Claude Code HooksSection, a CodexCapabilities record, and an optional
 * path-rewrite map, then returns a Codex-safe HooksSection with:
 *   - Unsupported events dropped (SubagentStart, SubagentStop, etc.)
 *   - Unsupported matchers filtered (SessionStart only allows startup|resume)
 *   - additionalContext NOT emitted here — that's the wrapper's job at runtime
 *   - command paths optionally rewritten from source dir → wrapper dir
 *   - permissionDecision values scrubbed to the selected Codex capability entry
 *
 * This function is pure (no I/O). All side-effects live in the caller.
 */
import { homedir } from "node:os";
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
	/**
	 * Per-file command substitution map: absolute original hook path → absolute wrapper path.
	 *
	 * When provided, `rewriteCommandPath` resolves any path substring in the command string
	 * against this map BEFORE falling back to the directory-level `sourceDir → targetDir` rewrite.
	 * This is the fix for GH-730 N1: wrappers were generated but never referenced in hooks.json
	 * because the directory rewrite pointed at the original copied files, not the hash-prefixed
	 * wrappers. Per-file substitution takes precedence; directory rewrite is fallback for hooks
	 * not covered by the map.
	 *
	 * Keys are absolute paths (e.g. `/Users/kai/.claude/hooks/session-init.cjs`).
	 * Values are absolute wrapper paths (e.g. `/Users/kai/.codex/hooks/deadbeef-session-init.cjs`).
	 * The lookup also handles `$HOME` and `~` prefixes in command strings by resolving them
	 * against `homedir()` before comparison.
	 */
	commandSubstitutions?: Map<string, string>;
	/**
	 * Absolute project root for project-scope migrations (process.cwd() at migrate time).
	 * When set, $CLAUDE_PROJECT_DIR variable forms in commands are resolved against it:
	 * Phase 1 candidates gain project-dir-variable forms, and the Phase 2 fallback
	 * replaces residual $CLAUDE_PROJECT_DIR tokens with this absolute path.
	 * Undefined for global-scope migrations (no behavior change).
	 */
	projectDir?: string;
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
		// For SessionStart and tool events, allowed matcher values are capability-driven.
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
 * Rewrite a hook command string.
 *
 * Two-phase rewrite (per-file substitution wins over directory-level rewrite):
 *
 * Phase 1 — Per-file substitution (GH-730 N1 fix):
 *   If `pathRewrite.commandSubstitutions` is provided, scan the command string for any
 *   path substring that matches a key in the map (after normalising `$HOME` / `~` to
 *   the real home directory).  Each matching hook script path is replaced with its
 *   corresponding hash-prefixed wrapper path before the directory fallback runs.
 *
 * Phase 2 — Directory-level fallback:
 *   If no per-file match was found (hook not covered by substitution map, or no map
 *   provided), fall back to the existing `sourceDir → targetDir` directory rewrite.
 *   Appends a trailing slash to prevent partial name matches
 *   (e.g. `.claude/hooks-extra` vs `.claude/hooks`).
 */
export function rewriteCommandPath(command: string, pathRewrite: PathRewriteMap): string {
	const normalizeSlashes = (s: string) => s.replace(/\\/g, "/");
	let rewritten = command;

	// Phase 1: per-file substitution — wrapper paths take precedence over dir rewrite
	if (pathRewrite.commandSubstitutions && pathRewrite.commandSubstitutions.size > 0) {
		const home = homedir();
		// Forward-slash form of homedir — Claude Code writes hook commands as
		// `node "$HOME/.claude/hooks/X.cjs"` on ALL platforms including Windows.
		// So the command always uses forward slashes and literal `$HOME`, never
		// the platform abs path or `%USERPROFILE%`. We must match that form.
		const homeForward = normalizeSlashes(home);
		const projectDirForward = pathRewrite.projectDir
			? normalizeSlashes(pathRewrite.projectDir)
			: null;

		for (const [originalAbsPath, wrapperAbsPath] of pathRewrite.commandSubstitutions) {
			// Forward-slash form of the original absolute path key.
			const originalAbsForward = normalizeSlashes(originalAbsPath);

			// Compute the path relative to home (if originalAbsPath is under home).
			// e.g. home=C:\Users\test, abs=C:\Users\test\.claude\hooks\X.cjs
			//      → rel = .claude/hooks/X.cjs (no leading slash)
			let relFromHome: string | null = null;
			if (originalAbsForward.startsWith(`${homeForward}/`)) {
				relFromHome = originalAbsForward.slice(homeForward.length + 1); // strip "home/"
			} else if (originalAbsForward === homeForward) {
				relFromHome = "";
			}

			// Compute the path relative to projectDir (if set and originalAbsPath is under it).
			let relFromProject: string | null = null;
			if (projectDirForward !== null) {
				if (originalAbsForward.startsWith(`${projectDirForward}/`)) {
					relFromProject = originalAbsForward.slice(projectDirForward.length + 1);
				} else if (originalAbsForward === projectDirForward) {
					relFromProject = "";
				}
			}

			// Normalize both the command and each candidate to forward slashes before
			// includes() so that backslash/forward-slash variants never cause a miss.
			// The wrapper output uses the wrapperAbsPath as-is; callers (hooks-settings-merger)
			// supply absolute platform-appropriate wrapper paths.
			const wrapperForward = normalizeSlashes(wrapperAbsPath);

			// Build candidates covering every form Claude Code may write in a command.
			// Each candidate is a {text, replacement} pair so quoted forms can carry
			// a quoted wrapper path (one pair of quotes, no doubling).
			//
			//   1. Raw absolute path (both slash forms) — primary form on POSIX
			//   2. $HOME/<rel>  ← Claude's universal form on ALL platforms (THE missing one)
			//   3. ~/<rel>
			//   4. %USERPROFILE%/<rel>  — Windows belt-and-suspenders
			//   5. ${HOME}/<rel>
			//   6-9. $CLAUDE_PROJECT_DIR forms (longest/most-specific first):
			//      a. "$CLAUDE_PROJECT_DIR/<rel>"  — fully quoted (replacement: "<wrapper>")
			//      b. "$CLAUDE_PROJECT_DIR"/<rel>  — var-only quoted, Claude Code standard (replacement: "<wrapper>")
			//      c. "${CLAUDE_PROJECT_DIR}"/<rel> — braced quoted (replacement: "<wrapper>")
			//      d. ${CLAUDE_PROJECT_DIR}/<rel>  — braced bare (replacement: wrapper)
			//      e. $CLAUDE_PROJECT_DIR/<rel>    — bare (replacement: wrapper)
			//      f. %CLAUDE_PROJECT_DIR%/<rel>   — Windows quoted/bare forms
			const candidates: Array<{ text: string; replacement: string }> = [
				{ text: originalAbsForward, replacement: wrapperForward },
				{ text: originalAbsPath, replacement: wrapperForward },
			];
			if (relFromHome !== null && relFromHome !== "") {
				candidates.push({ text: `$HOME/${relFromHome}`, replacement: wrapperForward }); // Claude's universal form
				candidates.push({ text: `~/${relFromHome}`, replacement: wrapperForward });
				candidates.push({ text: `%USERPROFILE%/${relFromHome}`, replacement: wrapperForward });
				candidates.push({ text: `\${HOME}/${relFromHome}`, replacement: wrapperForward });
			}
			if (relFromProject !== null && relFromProject !== "") {
				// Quoted fully: "$CLAUDE_PROJECT_DIR/<rel>" → "<wrapper>"
				// (includes both outer quotes so they are replaced as a unit — no doubling)
				candidates.push({
					text: `"$CLAUDE_PROJECT_DIR/${relFromProject}"`,
					replacement: `"${wrapperForward}"`,
				});
				// Var-only quoted (Claude Code standard): "$CLAUDE_PROJECT_DIR"/<rel> → "<wrapper>"
				candidates.push({
					text: `"$CLAUDE_PROJECT_DIR"/${relFromProject}`,
					replacement: `"${wrapperForward}"`,
				});
				// Braced quoted: "${CLAUDE_PROJECT_DIR}"/<rel> → "<wrapper>"
				candidates.push({
					text: `"\${CLAUDE_PROJECT_DIR}"/${relFromProject}`,
					replacement: `"${wrapperForward}"`,
				});
				// Windows quoted: "%CLAUDE_PROJECT_DIR%"/<rel> → "<wrapper>"
				candidates.push({
					text: `"%CLAUDE_PROJECT_DIR%"/${relFromProject}`,
					replacement: `"${wrapperForward}"`,
				});
				// Braced bare: ${CLAUDE_PROJECT_DIR}/<rel> → wrapper
				candidates.push({
					text: `\${CLAUDE_PROJECT_DIR}/${relFromProject}`,
					replacement: wrapperForward,
				});
				// Bare: $CLAUDE_PROJECT_DIR/<rel> → wrapper
				candidates.push({
					text: `$CLAUDE_PROJECT_DIR/${relFromProject}`,
					replacement: wrapperForward,
				});
				// Windows bare: %CLAUDE_PROJECT_DIR%/<rel> → "<wrapper>" (always quoted, per plan)
				candidates.push({
					text: `%CLAUDE_PROJECT_DIR%/${relFromProject}`,
					replacement: `"${wrapperForward}"`,
				});
			}

			for (const { text, replacement } of candidates) {
				const candidateNorm = normalizeSlashes(text);
				const rewrittenNorm = normalizeSlashes(rewritten);
				if (rewrittenNorm.includes(candidateNorm)) {
					// Replace every matched hook script path with its wrapper. Do not
					// return early: runner commands can contain both a shell runner and
					// the actual Node hook path, and all matching hook paths must be
					// processed before the directory-level fallback rewrites leftovers.
					rewritten = replaceCommandCandidate(rewrittenNorm, candidateNorm, replacement);
				}
			}
		}
	}

	// Phase 2: directory-level fallback
	// Normalize separators to forward-slash for matching (handles Windows backslash paths).
	const src = normalizeSlashes(
		pathRewrite.sourceDir.endsWith("/") || pathRewrite.sourceDir.endsWith("\\")
			? pathRewrite.sourceDir
			: `${pathRewrite.sourceDir}/`,
	);
	const tgt = normalizeSlashes(
		pathRewrite.targetDir.endsWith("/") || pathRewrite.targetDir.endsWith("\\")
			? pathRewrite.targetDir
			: `${pathRewrite.targetDir}/`,
	);
	// Short-circuit when source and target are identical (no-op rewrite)
	if (src !== tgt) {
		const normalizedRewritten = normalizeSlashes(rewritten);
		if (normalizedRewritten.includes(src)) {
			rewritten = normalizedRewritten.replaceAll(src, tgt);
		}
	}

	// Phase 2 residual: resolve any remaining $CLAUDE_PROJECT_DIR tokens when projectDir is set.
	// Non-wrappable hooks (e.g. .sh, runner scripts) may not have a substitution map entry and
	// will reach here still containing the env-var token — emit the absolute project path instead.
	//
	// Replacement order: quoted + longest first to prevent partial matches and double-quote
	// accumulation (H1 trap: the closing quote of a fully-quoted form MUST be consumed, not
	// left as a dangler — e.g. `"$CLAUDE_PROJECT_DIR/runner.sh"` → `"/proj/runner.sh"`, NOT
	// `"/proj/runner.sh""`).
	//
	// Negative guard: token must be followed by `/`, end-of-string, `"`, `'`, or whitespace —
	// this prevents matching `$CLAUDE_PROJECT_DIRS` or URL substrings.
	if (pathRewrite.projectDir) {
		const pd = normalizeSlashes(pathRewrite.projectDir);

		// Replacement order: handle most-specific / longest forms first to prevent
		// partial-match corruption and double-quote accumulation (H1 trap).
		//
		// Key invariant: forms that include the var-token's opening or closing quote in
		// their match pattern must consume BOTH quotes in a single pass so the replacement
		// emits exactly ONE pair of quotes — never `"path""` or `"path`.

		// Pass 1: fully-quoted form 1 with mandatory suffix — "$CLAUDE_PROJECT_DIR/<suffix>"
		// Requires at least one `/` after the var name so form 2 ("$CLAUDE_PROJECT_DIR"/<suffix>)
		// is not accidentally consumed here (form 2 has the closing quote immediately after the var).
		rewritten = rewritten.replace(
			/"(\$CLAUDE_PROJECT_DIR)(\/[^"]+)"/g,
			(_match, _varRef: string, suffix: string) => `"${pd}${suffix}"`,
		);

		// Pass 2: var-only quoted form 2 — "$CLAUDE_PROJECT_DIR"/<suffix>
		// Also handles bare-var form 6 when there is no suffix: cd "$CLAUDE_PROJECT_DIR" && ...
		// Suffix class excludes whitespace, quotes, AND shell metacharacters (;, &, |, (, )) to
		// prevent swallowing command separators into the quoted path (e.g. `node $X/f.cjs;echo hi`
		// must NOT produce `node "/proj/f.cjs;echo" hi`).
		rewritten = rewritten.replace(
			/"(\$CLAUDE_PROJECT_DIR)"(\/[^\s"';&|()]*)?/g,
			(_match, _varRef: string, suffix: string | undefined) => `"${pd}${suffix ?? ""}"`,
		);

		// Pass 3a: braced, var-only quoted with suffix — "${CLAUDE_PROJECT_DIR}"/<suffix>
		// Same metacharacter exclusion as pass 2.
		rewritten = rewritten.replace(
			/"\$\{CLAUDE_PROJECT_DIR\}"(\/[^\s"';&|()]*)?/g,
			(_match, suffix: string | undefined) => `"${pd}${suffix ?? ""}"`,
		);

		// Pass 3b: braced bare — ${CLAUDE_PROJECT_DIR}/<suffix>
		// Emit quoted output for safety (paths may contain spaces).
		// Same metacharacter exclusion as pass 2.
		rewritten = rewritten.replace(
			/\$\{CLAUDE_PROJECT_DIR\}(\/[^\s"';&|()]*)?/g,
			(_match, suffix: string | undefined) => `"${pd}${suffix ?? ""}"`,
		);

		// Pass 4a: Windows fully-quoted form — "%CLAUDE_PROJECT_DIR%/<suffix>"
		// Must run before the var-only quoted form (pass 4b) to consume the full suffix.
		// Fully-quoted: suffix delimited by the closing `"` so `[^"]+` is correct here.
		rewritten = rewritten.replace(
			/"%CLAUDE_PROJECT_DIR%(\/[^"]+)"/g,
			(_match, suffix: string) => `"${pd}${suffix}"`,
		);

		// Pass 4b: Windows var-only quoted form — "%CLAUDE_PROJECT_DIR%"/<suffix>
		// Same metacharacter exclusion as pass 2.
		rewritten = rewritten.replace(
			/"%CLAUDE_PROJECT_DIR%"(\/[^\s"';&|()]*)?/g,
			(_match, suffix: string | undefined) => `"${pd}${suffix ?? ""}"`,
		);

		// Pass 4c: Windows bare form — %CLAUDE_PROJECT_DIR%/<suffix>
		// Anchor end: followed by whitespace, quote, or end-of-string to avoid false matches.
		// Same metacharacter exclusion as pass 2.
		rewritten = rewritten.replace(
			/%CLAUDE_PROJECT_DIR%(\/[^\s"';&|()]*)?(?=[\s"']|$)/g,
			(_match, suffix: string | undefined) => `"${pd}${suffix ?? ""}"`,
		);

		// Pass 5: bare dollar form — $CLAUDE_PROJECT_DIR/<suffix> (no braces, no quotes)
		// Negative lookahead `(?![A-Za-z0-9_])` prevents matching `$CLAUDE_PROJECT_DIRS` or
		// any other superset variable name. Captures optional `/suffix` greedily up to
		// whitespace, quote, shell metacharacter, or end-of-string.
		// Note: passes 1–4 have already consumed any quoted or braced occurrences, so only
		// truly bare tokens remain here.
		rewritten = rewritten.replace(
			/\$CLAUDE_PROJECT_DIR(?![A-Za-z0-9_])(\/[^\s"';&|()]*)?/g,
			(_match, suffix: string | undefined) => `"${pd}${suffix ?? ""}"`,
		);
	}

	return rewritten;
}

function replaceCommandCandidate(command: string, candidate: string, replacement: string): string {
	if (!isRelativeCommandCandidate(candidate)) {
		return command.replaceAll(candidate, replacement);
	}

	const pattern = new RegExp(`(^|[\\s"'])${escapeRegExp(candidate)}`, "g");
	return command.replace(pattern, (_match, prefix: string) => `${prefix}${replacement}`);
}

function isRelativeCommandCandidate(candidate: string): boolean {
	// Quoted candidates (starting with `"`) and variable-prefixed candidates that are
	// fully-specified tokens already contain their own delimiters — use plain replaceAll.
	// Word-boundary regex is only needed for truly relative bare paths (no leading / or $).
	return (
		!candidate.startsWith("/") &&
		!candidate.startsWith("$HOME/") &&
		!candidate.startsWith("~/") &&
		!candidate.startsWith('"') &&
		!candidate.startsWith("$CLAUDE_PROJECT_DIR") &&
		!candidate.startsWith("${CLAUDE_PROJECT_DIR}") &&
		!candidate.startsWith("%CLAUDE_PROJECT_DIR%")
	);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
