/**
 * Codex sync discoverability notice.
 *
 * Codex-as-a-migration-target sync is opt-in (updatePipeline.autoMigrateAfterUpdate).
 * Users with Codex installed often do not know the feature exists, so this small
 * notice is shown on every post-update migrate run while sync is OFF — a persistent
 * nudge, not a one-time banner. It disappears once the user enables auto-sync.
 */

const CODEX_PROVIDER = "codex";

/**
 * Whether to surface the Codex sync notice: Codex is installed AND the user has
 * not enabled auto-migrate. Pure predicate for testability.
 */
export function shouldShowCodexSyncNotice(params: {
	providers: string[];
	autoMigrateEnabled: boolean;
}): boolean {
	return !params.autoMigrateEnabled && params.providers.includes(CODEX_PROVIDER);
}

/** Short, clear notice lines (ASCII markers only, no emoji). */
export function codexSyncNoticeLines(): string[] {
	return [
		"[i] Codex detected. ClaudeKit can keep it in sync with Claude Code on each update (opt-in).",
		"    Enable: ck config set updatePipeline.autoMigrateAfterUpdate true  |  One-off: ck migrate --agent codex",
	];
}
