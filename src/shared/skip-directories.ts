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

const SKIP_DIRS_ALL_SET = new Set(SKIP_DIRS_ALL);

/**
 * Check whether a relative path contains any skipped directory segment.
 * This is a defensive fallback for callers that operate on file paths
 * after scanning, so runtime artifact trees never re-enter later stages.
 */
export function hasSkippedDirectorySegment(
	relativePath: string,
	skipDirs: readonly string[] = SKIP_DIRS_ALL,
): boolean {
	const segments = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
	const skipSet = skipDirs === SKIP_DIRS_ALL ? SKIP_DIRS_ALL_SET : new Set(skipDirs);

	return segments.some((segment) => skipSet.has(segment));
}

/**
 * Only Claude Code internal directories to skip
 * Use this for ClaudeKit-specific scanning (e.g., counting components)
 */
export const SKIP_DIRS_CLAUDE_INTERNAL = CLAUDE_CODE_INTERNAL_DIRS;
