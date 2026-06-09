/**
 * Codex sync discoverability notice.
 *
 * Codex-as-a-migration-target sync is opt-in (updatePipeline.autoMigrateAfterUpdate).
 * Users with Codex installed often do not know the feature exists, so this small
 * panel is shown on every post-update migrate run while sync is OFF — a persistent
 * nudge, not a one-time banner. It disappears once the user enables auto-sync.
 *
 * Rendering uses the shared CLI panel (unicode box when supported, plain
 * marker-based fallback for non-TTY / NO_COLOR terminals).
 */

import { renderPanel } from "@/ui/ck-cli-design/panel.js";

const CODEX_PROVIDER = "codex";

/** Plain-language message data, kept separate from rendering for testability. */
export const codexSyncNotice = {
	title: "Codex sync available",
	body: "Keep Codex in step with Claude Code automatically: agents, commands, skills, and hooks.",
	actions: [
		{ label: "Sync now", command: "ck migrate --agent codex" },
		{ label: "Manage", command: "ck config" },
	],
} as const;

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

/** Render the notice as terminal lines (boxed when supported, plain otherwise). */
export function renderCodexSyncNotice(): string[] {
	// Body lives in a zone (the renderer wraps zone lines to the box width;
	// the panel subtitle is not wrapped). Empty label keeps it left-aligned in
	// the content column.
	return renderPanel({
		title: codexSyncNotice.title,
		zones: [
			{ label: "", lines: [codexSyncNotice.body] },
			...codexSyncNotice.actions.map((action) => ({
				label: action.label,
				lines: [action.command],
			})),
		],
	});
}
