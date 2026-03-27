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
 */
export function normalizeCommand(cmd: string | null | undefined): string {
	if (!cmd) return "";
	let normalized = cmd;

	// Strip all double quotes first — quoting is only meaningful for shell execution, not comparison
	normalized = normalized.replace(/"/g, "");

	// Expand tilde to canonical $HOME (tilde doesn't expand on Windows)
	normalized = normalized.replace(/~\//g, "$HOME/");

	// Canonicalize all path variable variants to $HOME
	normalized = normalized.replace(/\$CLAUDE_PROJECT_DIR/g, "$HOME");
	normalized = normalized.replace(/\$\{HOME\}/g, "$HOME");
	normalized = normalized.replace(/%USERPROFILE%/g, "$HOME");
	normalized = normalized.replace(/%CLAUDE_PROJECT_DIR%/g, "$HOME");

	// Normalize path separators (Windows backslashes → forward slashes)
	normalized = normalized.replace(/\\/g, "/");

	// Normalize whitespace
	normalized = normalized.replace(/\s+/g, " ").trim();

	return normalized;
}
