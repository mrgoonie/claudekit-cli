import { homedir } from "node:os";
import { join } from "node:path";
import { PathResolver } from "@/shared/path-resolver.js";

export type ClaudeNodeCommandIssue = "raw-relative" | "invalid-format";

export interface ClaudeNodeCommandRepairResult {
	command: string;
	changed: boolean;
	issue: ClaudeNodeCommandIssue | null;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCommandRoot(root: string): string {
	return root.replace(/\\/g, "/").replace(/\/+$/, "");
}

function formatCanonicalClaudeCommand(
	nodePrefix: string,
	root: string,
	relativePath: string,
	suffix = "",
): string {
	const normalizedRoot = normalizeCommandRoot(root);
	let normalizedRelativePath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

	if (normalizedRoot !== "$HOME" && normalizedRoot !== "$CLAUDE_PROJECT_DIR") {
		normalizedRelativePath = normalizedRelativePath.replace(/^\.claude\//, "");
	}

	return normalizedRoot === "$CLAUDE_PROJECT_DIR"
		? `${nodePrefix}"${normalizedRoot}"/${normalizedRelativePath}${suffix}`
		: `${nodePrefix}"${normalizedRoot}/${normalizedRelativePath}"${suffix}`;
}

/**
 * Returns true for `node` commands targeting `.claude/...` paths.
 * Non-node commands are intentionally ignored so user-managed commands are untouched.
 */
export function isNodeClaudeCommand(cmd: string | null | undefined): boolean {
	if (!cmd) return false;
	return /^\s*node\s+/.test(cmd) && (cmd.includes(".claude/") || cmd.includes(".claude\\"));
}

/**
 * Canonicalize a `node` command targeting `.claude/...` into the expected scope-aware form.
 *
 * Accepted target roots:
 * - `$CLAUDE_PROJECT_DIR` for project-local settings
 * - `$HOME` for default global settings
 * - `/custom/claude-dir` for custom global install roots
 */
export function repairClaudeNodeCommandPath(
	cmd: string | null | undefined,
	root: string,
): ClaudeNodeCommandRepairResult {
	if (!cmd || !isNodeClaudeCommand(cmd)) {
		return { command: cmd ?? "", changed: false, issue: null };
	}

	// Canonical guard: if the command is already in the canonical form MATCHING the
	// current root, it is already correct and must not be changed.
	//
	// Only guards same-scope matches (root=$HOME → $HOME form, root=$CLAUDE_PROJECT_DIR →
	// $CLAUDE_PROJECT_DIR form). Cross-scope re-rooting is intentional in SettingsProcessor
	// (e.g., re-rooting $CLAUDE_PROJECT_DIR form to $HOME during global install).
	//
	// The health-checker's convergence guarantee for cross-scope canonical forms
	// (e.g., $HOME hook in project settings or vice-versa) is handled separately in
	// collectHookCommandFindings via isAlreadyCanonical — see hook-health-checker.ts.
	//
	// Canonical forms (exactly two):
	//   node "$HOME/.claude/..."              — $HOME, full-path-in-quotes style
	//   node "$CLAUDE_PROJECT_DIR"/.claude/... — $CLAUDE_PROJECT_DIR, var-only-quoted style
	if (root === "$HOME" && /^node\s+"\$HOME\/\.claude\/[^"]+"/.test(cmd)) {
		return { command: cmd, changed: false, issue: null };
	}
	if (root === "$CLAUDE_PROJECT_DIR" && /^node\s+"\$CLAUDE_PROJECT_DIR"\/\.claude\/\S+/.test(cmd)) {
		return { command: cmd, changed: false, issue: null };
	}

	const bareRelativeMatch = cmd.match(/^(node\s+)(?:\.\/)?(\.claude[/\\][^\s"]+)(.*)$/);
	if (bareRelativeMatch) {
		const [, nodePrefix, relativePath, suffix] = bareRelativeMatch;
		const command = formatCanonicalClaudeCommand(nodePrefix, root, relativePath, suffix);
		return { command, changed: command !== cmd, issue: "raw-relative" };
	}

	const embeddedQuotedMatch = cmd.match(
		/^(node\s+)"(?:\$HOME|\$CLAUDE_PROJECT_DIR|%USERPROFILE%|%CLAUDE_PROJECT_DIR%)[/\\](\.claude[/\\][^"]+)"(.*)$/,
	);
	if (embeddedQuotedMatch) {
		const [, nodePrefix, relativePath, suffix] = embeddedQuotedMatch;
		const command = formatCanonicalClaudeCommand(nodePrefix, root, relativePath, suffix);
		return { command, changed: command !== cmd, issue: "invalid-format" };
	}

	const varOnlyQuotedMatch = cmd.match(
		/^(node\s+)"(?:\$HOME|\$CLAUDE_PROJECT_DIR|%USERPROFILE%|%CLAUDE_PROJECT_DIR%)"[/\\](\.claude[/\\][^\s"]+)(.*)$/,
	);
	if (varOnlyQuotedMatch) {
		const [, nodePrefix, relativePath, suffix] = varOnlyQuotedMatch;
		const command = formatCanonicalClaudeCommand(nodePrefix, root, relativePath, suffix);
		return { command, changed: command !== cmd, issue: "invalid-format" };
	}

	const tildeMatch = cmd.match(/^(node\s+)~[/\\](\.claude[/\\][^\s"]+)(.*)$/);
	if (tildeMatch) {
		const [, nodePrefix, relativePath, suffix] = tildeMatch;
		const command = formatCanonicalClaudeCommand(nodePrefix, root, relativePath, suffix);
		return { command, changed: command !== cmd, issue: "invalid-format" };
	}

	const unquotedMatch = cmd.match(
		/^(node\s+)(?:\$HOME|\$CLAUDE_PROJECT_DIR|%USERPROFILE%|%CLAUDE_PROJECT_DIR%)[/\\](\.claude[/\\][^\s"]+)(.*)$/,
	);
	if (unquotedMatch) {
		const [, nodePrefix, relativePath, suffix] = unquotedMatch;
		const command = formatCanonicalClaudeCommand(nodePrefix, root, relativePath, suffix);
		return { command, changed: command !== cmd, issue: "invalid-format" };
	}

	// 6th branch: raw absolute paths with .claude/ segment
	// Matches: node "/abs/path/.claude/hooks/foo.cjs" or node "C:\abs\.claude\hooks\foo.cjs"
	// Quoted (POSIX/Windows) and unquoted (no spaces, drive-letter) variants.
	const absoluteMatch =
		cmd.match(/^(node\s+)"((?:[A-Za-z]:[/\\]|\/)[^"]*?[/\\]\.claude[/\\][^"]+)"(.*)$/) ??
		cmd.match(/^(node\s+)((?:[A-Za-z]:[\\/]|\/)[^\s"]*?[\\/]\.claude[\\/][^\s"]+)(.*)$/);

	if (absoluteMatch) {
		const [, nodePrefix, absolutePath, suffix] = absoluteMatch;
		const normalizedAbsPath = absolutePath.replace(/\\/g, "/");
		// Defensive: regex guarantees `.claude/` is present, but bail out cleanly if not.
		const dotClaudeIdx = normalizedAbsPath.indexOf("/.claude/");
		if (dotClaudeIdx === -1) {
			return { command: cmd, changed: false, issue: null };
		}

		// Resolve global-scope candidate roots: homedir + custom CLAUDE_CONFIG_DIR if set.
		// Windows paths are case-insensitive; lowercase both sides on win32 only.
		const isWin = process.platform === "win32";
		const cmp = (s: string) => (isWin ? s.toLowerCase() : s);
		const globalRoots = [
			`${homedir().replace(/\\/g, "/").replace(/\/+$/, "")}/.claude/`,
			`${PathResolver.getGlobalKitDir().replace(/\\/g, "/").replace(/\/+$/, "")}/`,
		];
		const isUnderGlobal = globalRoots.some((g) => cmp(normalizedAbsPath).startsWith(cmp(g)));
		const resolvedRoot = isUnderGlobal ? "$HOME" : root;

		const relativePath = normalizedAbsPath.slice(dotClaudeIdx + 1); // ".claude/hooks/foo.cjs"
		const command = formatCanonicalClaudeCommand(nodePrefix, resolvedRoot, relativePath, suffix);
		return { command, changed: command !== cmd, issue: "invalid-format" };
	}

	return { command: cmd, changed: false, issue: null };
}

/**
 * Normalize hook command strings for consistent comparison.
 * Canonicalizes path variables and quoting styles to enable matching across formats.
 *
 * Handles all known formats:
 * - Full-path quoting: node "$HOME/.claude/hooks/foo.cjs"
 * - Variable-only quoting: node "$HOME"/.claude/hooks/foo.cjs
 * - Unquoted: node $HOME/.claude/hooks/foo.cjs
 * - Tilde: node ~/.claude/hooks/foo.cjs
 * - Windows: node "%USERPROFILE%/.claude/hooks/foo.cjs"
 * - Bare relative: node .claude/hooks/foo.cjs
 */
export function normalizeCommand(cmd: string | null | undefined): string {
	if (!cmd) return "";
	let normalized = cmd;
	const globalKitDir = PathResolver.getGlobalKitDir().replace(/\\/g, "/").replace(/\/+$/, "");
	const defaultGlobalKitDir = join(homedir(), ".claude").replace(/\\/g, "/");

	// Strip all double quotes first — quoting is only meaningful for shell execution, not comparison
	normalized = normalized.replace(/"/g, "");

	// Expand tilde to canonical $HOME (tilde doesn't expand on Windows)
	normalized = normalized.replace(/~\//g, "$HOME/");

	// Canonicalize all path variable variants to $HOME
	normalized = normalized.replace(/\$CLAUDE_PROJECT_DIR/g, "$HOME");
	normalized = normalized.replace(/\$\{HOME\}/g, "$HOME");
	normalized = normalized.replace(/%USERPROFILE%/g, "$HOME");
	normalized = normalized.replace(/%CLAUDE_PROJECT_DIR%/g, "$HOME");

	// Normalize bare relative .claude/ to $HOME/.claude/ for consistent dedup
	// Matches .claude/ or ./.claude/ preceded by whitespace or start of string
	// Won't match $HOME/.claude/ (preceded by /) — already canonical
	normalized = normalized.replace(/(^|\s)(?:\.\/)?\.claude\//g, "$1$HOME/.claude/");

	// Normalize path separators (Windows backslashes → forward slashes)
	normalized = normalized.replace(/\\/g, "/");

	// Normalize absolute global install paths to canonical $HOME/.claude form
	// Deduplicate to avoid redundant regex when CLAUDE_CONFIG_DIR is not set
	const globalPaths = [...new Set([globalKitDir, defaultGlobalKitDir].filter(Boolean))];
	for (const absoluteGlobalPath of globalPaths) {
		const absoluteGlobalPathPattern = new RegExp(escapeRegex(absoluteGlobalPath), "g");
		normalized = normalized.replace(absoluteGlobalPathPattern, "$HOME/.claude");
	}

	// Normalize whitespace
	normalized = normalized.replace(/\s+/g, " ").trim();

	return normalized;
}
