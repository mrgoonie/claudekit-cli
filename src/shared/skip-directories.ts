/**
 * Directories to skip during file scanning operations.
 *
 * These directories are excluded to avoid:
 * - Permission issues (venvs, node_modules)
 * - Unnecessary scans (build artifacts, version control)
 * - Claude Code internal directories (not ClaudeKit files)
 */

/**
 * Build artifacts and package directories to skip
 */
export const BUILD_ARTIFACT_DIRS: readonly string[] = [
	"node_modules",
	".venv",
	"venv",
	".test-venv",
	"__pycache__",
	".git",
	".svn",
	"dist",
	"build",
];

/**
 * Claude Code internal directories to skip
 * These are managed by Claude Code itself, not ClaudeKit
 */
export const CLAUDE_CODE_INTERNAL_DIRS: readonly string[] = [
	"debug",
	"projects",
	"shell-snapshots",
	"file-history",
	"todos",
	"session-env",
	"statsig",
	"telemetry",
	".anthropic",
];

/**
 * All directories to skip during file scanning (full list)
 * Use this for general file operations that scan entire directories
 */
export const SKIP_DIRS_ALL: readonly string[] = [
	...BUILD_ARTIFACT_DIRS,
	...CLAUDE_CODE_INTERNAL_DIRS,
];

/**
 * Only Claude Code internal directories to skip
 * Use this for ClaudeKit-specific scanning (e.g., counting components)
 */
export const SKIP_DIRS_CLAUDE_INTERNAL = CLAUDE_CODE_INTERNAL_DIRS;
