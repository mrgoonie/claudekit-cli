/**
 * Zombie wirings pruner — removes stale engineer-tagged hook entries from settings.json.
 *
 * On every `ck init`, after the canonical merge, this walks all hook events and
 * drops any entry tagged `_origin: "engineer"` whose referenced hook file no longer
 * exists on disk. This auto-cleans:
 *   - node-hook-runner.sh references (removed in Phase 4)
 *   - skill-dedup.cjs references (removed in Phase 5)
 *   - Any future hook removed from the kit
 *   - Old-version zombies users carried forward from pre-plan installs
 *
 * Conservative by design: entries without `_origin: "engineer"` are NEVER pruned,
 * even if the referenced file is missing. This preserves user-added wirings.
 * Exception: known legacy ClaudeKit prompt hooks with the old hard-coded
 * descriptive-name text are pruned because they conflict with the current
 * language-aware command hook and cannot self-heal via missing-file checks.
 */
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";
import type { HookConfig, HookEntry, SettingsJson } from "@/domains/config/merger/types.js";

export interface PruneResult {
	settings: SettingsJson;
	pruned: string[];
}

/**
 * Remove zombie engineer-tagged hook entries from settings.
 *
 * @param settings - The merged settings object (mutated in place for efficiency)
 * @param hookDir  - Absolute path to the hooks directory (used as base for relative paths)
 * @returns Mutated settings and list of pruned file basenames
 */
export function pruneZombieEngineerWirings(settings: SettingsJson, hookDir: string): PruneResult {
	const pruned: string[] = [];

	// Defense-in-depth: if hookDir is absent or contains no hook files, every existsSync
	// check would false-negative and could prune everything. Skip pruning entirely in
	// that state — no files on disk means "not landed yet", not "all are zombies".
	if (!existsSync(hookDir)) {
		return { settings, pruned };
	}
	const hookFiles = readdirSync(hookDir);
	const hasHookFiles = hookFiles.some((f) => f.endsWith(".cjs") || f.endsWith(".sh"));
	if (!hasHookFiles) {
		return { settings, pruned };
	}

	if (!settings.hooks) {
		return { settings, pruned };
	}

	const eventKeysToDelete: string[] = [];
	const events = settings.hooks;

	for (const eventName of Object.keys(events)) {
		const groups = events[eventName] as Array<HookConfig | HookEntry>;
		const keptGroups: typeof groups = [];

		for (const group of groups) {
			if (!("hooks" in group) || !Array.isArray(group.hooks)) {
				// Flat HookEntry (no hooks array) — apply same pruning logic
				const entry = group as HookEntry;
				if (shouldPruneEntry(entry, hookDir, pruned)) {
					continue;
				}
				keptGroups.push(group);
				continue;
			}

			// HookConfig with hooks array — filter individual hook entries
			const keptHooks = (group.hooks as HookEntry[]).filter((h) => {
				return !shouldPruneEntry(h, hookDir, pruned);
			});

			if (keptHooks.length > 0) {
				keptGroups.push({ ...group, hooks: keptHooks });
			}
			// Empty hook array groups are dropped
		}

		if (keptGroups.length > 0) {
			events[eventName] = keptGroups;
		} else {
			eventKeysToDelete.push(eventName);
		}
	}

	// Remove events that became empty after pruning
	for (const key of eventKeysToDelete) {
		delete events[key];
	}

	return { settings, pruned };
}

/**
 * Determine whether a single hook entry should be pruned.
 * Side-effect: pushes the basename to `pruned` list when pruning.
 */
function shouldPruneEntry(entry: HookEntry, hookDir: string, pruned: string[]): boolean {
	if (isLegacyDescriptiveNamePrompt(entry)) {
		pruned.push("legacy-descriptive-name-prompt");
		return true;
	}

	// Conservative: only prune entries explicitly tagged as engineer-origin
	if (entry._origin !== "engineer") return false;

	const filePath = extractHookFilePath(entry.command, hookDir);
	if (!filePath) return false; // Can't resolve path — preserve (default-keep on uncertainty)

	if (existsSync(filePath)) return false; // File exists — keep

	// File missing and engineer-tagged — prune
	pruned.push(basename(filePath));
	return true;
}

export function isLegacyDescriptiveNamePrompt(entry: {
	type?: unknown;
	prompt?: unknown;
}): boolean {
	const prompt = entry.prompt;
	if (entry.type !== "prompt" || typeof prompt !== "string") return false;

	return (
		prompt.includes("Use kebab-case file naming") &&
		prompt.includes("self-documenting") &&
		prompt.includes("Grep, Glob, Search")
	);
}

/**
 * Extract the absolute hook file path from a hook command string.
 *
 * Handles these command forms (all produced by or recognised by this codebase):
 *   node "$HOME"/.claude/hooks/hook.cjs           (var-only-quoted, $HOME global)
 *   node "$CLAUDE_PROJECT_DIR"/.claude/hooks/hook.cjs  (var-only-quoted, project)
 *   node "$HOME/.claude/hooks/hook.cjs"           (full-path-in-quotes, global)
 *   node "$CLAUDE_PROJECT_DIR/.claude/hooks/h.cjs" (full-path-in-quotes, project)
 *   node "%USERPROFILE%/.claude/hooks/hook.cjs"   (Windows, full-path-in-quotes)
 *   node "%USERPROFILE%"/.claude/hooks/hook.cjs   (Windows, var-only-quoted)
 *   node "/abs/path/to/hook.cjs"                  (absolute, no env var)
 *   node "relative/hook.cjs"                      (relative, resolved vs hookDir)
 *   bash ".../node-hook-runner.sh" "arg"          (legacy bash form, 2nd token is target)
 *
 * Fail-safe: returns null when the form is unrecognised so callers preserve the entry.
 *
 * @param command - The hook command string from settings.json
 * @param hookDir - Base directory for resolving relative paths and $CLAUDE_PROJECT_DIR
 * @returns Absolute path to the hook file, or null if not parseable
 */
export function extractHookFilePath(command: string, hookDir: string): string | null {
	if (!command) return null;

	// Conservative guard: compound shell commands (&&, ||, ;, unquoted |) may
	// reference multiple executors. Extracting only the first token could cause a
	// false-prune when the first file is missing but a later one still ships.
	// Return null (preserve entry) for any compound form — never prune compound commands.
	if (/&&|\|\||;|(?<!["|'])\|(?!["|'])/.test(command)) return null;

	const home = homedir().replace(/\\/g, "/");
	const hookDirNorm = hookDir.replace(/\\/g, "/");

	// Helper: resolve env-var prefix + remainder to an absolute path string
	function resolveEnvPath(prefix: string, rest: string): string {
		const normRest = rest.replace(/\\/g, "/");
		let resolved: string;
		if (prefix === "$HOME" || prefix === "${HOME}" || prefix === "%USERPROFILE%") {
			resolved = `${home}/${normRest}`;
		} else if (prefix === "$CLAUDE_PROJECT_DIR" || prefix === "%CLAUDE_PROJECT_DIR%") {
			// hookDir is the hooks directory; project root is one level up (hooks/ inside .claude/)
			// For the canonical project form the env var maps to the project root that contains .claude/
			// The remainder always starts with ".claude/hooks/..." so we need the parent of hookDir's parent
			// i.e. the directory that CONTAINS the .claude dir.
			// hookDir = <projectRoot>/.claude/hooks  → projectRoot = dirname(dirname(hookDir))
			const projectRoot = dirname(dirname(hookDirNorm));
			resolved = `${projectRoot}/${normRest}`;
		} else {
			// Unrecognised prefix — return as-is and let the absolute check handle it
			resolved = `${prefix}/${normRest}`;
		}
		return resolved;
	}

	// Branch 1: bash legacy form — e.g. bash "/.../node-hook-runner.sh" "arg"
	// Target is the first quoted argument (the script path).
	if (/^bash\s/.test(command)) {
		const bashMatch = command.match(/^bash\s+["']([^"']+\.sh)["']/);
		if (bashMatch) {
			const rawPath = bashMatch[1].replace(/\\/g, "/");
			const resolved =
				isAbsolute(rawPath) || /^[A-Za-z]:[\\/]/.test(rawPath)
					? rawPath
					: resolve(hookDir, rawPath);
			return process.platform === "win32" ? resolved.replace(/\//g, sep) : resolved;
		}
		return null; // bash command but no recognisable script arg — preserve (fail-safe)
	}

	// Only handle `node` executor from here on. Anchor to word boundary to avoid matching
	// compound commands like `run-node "x.cjs"`.
	if (!/(?:^|\s)node\s/.test(command)) return null;

	// Branch 2: var-only-quoted form — node "$VAR"/rest  OR  node "$VAR"\rest
	// Canonical project form:  node "$CLAUDE_PROJECT_DIR"/.claude/hooks/x.cjs
	// Canonical global form:   (not canonical, but tolerate)  node "$HOME"/.claude/hooks/x.cjs
	const varOnlyQuoted = command.match(
		/(?:^|\s)node\s+["'](\$\w+|\$\{\w+\}|%\w+%)["'][/\\](\.claude[/\\]\S+)/,
	);
	if (varOnlyQuoted) {
		const [, envVar, rest] = varOnlyQuoted;
		const resolved = resolveEnvPath(envVar, rest);
		return process.platform === "win32" ? resolved.replace(/\//g, sep) : resolved;
	}

	// Branch 3: full-path-in-quotes — node "$HOME/.claude/hooks/x.cjs" or node "/abs/path/x.cjs"
	// or node "relative/path/x.cjs"
	const quotedMatch = command.match(/(?:^|\s)node\s+["']([^"']+)["']/);
	if (quotedMatch) {
		const rawArg = quotedMatch[1].trim().replace(/\\/g, "/");

		// Resolve env-var prefix if present (full-path-in-quotes style)
		const envPrefixMatch = rawArg.match(
			/^(\$HOME|\$\{HOME\}|%USERPROFILE%|\$CLAUDE_PROJECT_DIR|%CLAUDE_PROJECT_DIR%)[/\\](.*)/,
		);
		if (envPrefixMatch) {
			const resolved = resolveEnvPath(envPrefixMatch[1], envPrefixMatch[2]);
			return process.platform === "win32" ? resolved.replace(/\//g, sep) : resolved;
		}

		// Resolve tilde
		const tildeResolved = rawArg.replace(/^~(?=\/)/, home);

		// Already absolute or Windows drive letter
		if (isAbsolute(tildeResolved) || /^[A-Za-z]:[\\/]/.test(tildeResolved)) {
			return process.platform === "win32" ? tildeResolved.replace(/\//g, sep) : tildeResolved;
		}

		// Relative — resolve against hookDir
		return resolve(hookDir, tildeResolved);
	}

	// Branch 4: unquoted hook file — node relative/hook.cjs or node /abs/hook.cjs
	const unquotedMatch = command.match(/(?:^|\s)node\s+(\S+\.(?:cjs|sh|mjs|js))/);
	if (unquotedMatch) {
		const rawArg = unquotedMatch[1].replace(/\\/g, "/");

		// Check for unquoted env-var prefix
		const envPrefixMatch = rawArg.match(
			/^(\$HOME|\$\{HOME\}|%USERPROFILE%|\$CLAUDE_PROJECT_DIR|%CLAUDE_PROJECT_DIR%)[/\\](.*)/,
		);
		if (envPrefixMatch) {
			const resolved = resolveEnvPath(envPrefixMatch[1], envPrefixMatch[2]);
			return process.platform === "win32" ? resolved.replace(/\//g, sep) : resolved;
		}

		const tildeResolved = rawArg.replace(/^~(?=\/)/, home);
		if (isAbsolute(tildeResolved) || /^[A-Za-z]:[\\/]/.test(tildeResolved)) {
			return process.platform === "win32" ? tildeResolved.replace(/\//g, sep) : tildeResolved;
		}

		return resolve(hookDir, tildeResolved);
	}

	// Unrecognised form — preserve entry (fail-safe)
	return null;
}
