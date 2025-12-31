/**
 * Normalize hook command strings for consistent comparison.
 * Canonicalizes path variables to enable matching across formats.
 */
export function normalizeCommand(cmd: string): string {
	let normalized = cmd;

	// Canonicalize all path variable variants to $HOME
	// Handle quoted: "$HOME", "$CLAUDE_PROJECT_DIR"
	normalized = normalized.replace(/"\$HOME"/g, "$HOME");
	normalized = normalized.replace(/"\$CLAUDE_PROJECT_DIR"/g, "$HOME");
	normalized = normalized.replace(/"\$\{HOME\}"/g, "$HOME");

	// Handle unquoted: $HOME, $CLAUDE_PROJECT_DIR, ${HOME}
	normalized = normalized.replace(/\$CLAUDE_PROJECT_DIR/g, "$HOME");
	normalized = normalized.replace(/\$\{HOME\}/g, "$HOME");

	// Windows → Unix canonical
	normalized = normalized.replace(/"%USERPROFILE%"/g, "$HOME");
	normalized = normalized.replace(/%USERPROFILE%/g, "$HOME");
	normalized = normalized.replace(/"%CLAUDE_PROJECT_DIR%"/g, "$HOME");
	normalized = normalized.replace(/%CLAUDE_PROJECT_DIR%/g, "$HOME");

	// Normalize path separators
	normalized = normalized.replace(/\\/g, "/");

	// Normalize whitespace
	normalized = normalized.replace(/\s+/g, " ").trim();

	return normalized;
}
