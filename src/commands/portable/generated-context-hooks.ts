import { basename } from "node:path";

const GENERATED_CONTEXT_HOOK_FILENAMES = new Set([
	"cook-after-plan-reminder.cjs",
	"dev-rules-reminder.cjs",
	"plan-format-kanban.cjs",
	"session-init.cjs",
	"session-state.cjs",
	"subagent-init.cjs",
	"team-context-inject.cjs",
	"usage-context-awareness.cjs",
]);

// Keep this list in sync with claudekit-engineer metadata deletions and default hook settings.
export function isGeneratedContextHookName(name: string): boolean {
	const normalized = basename(name.replace(/\\/g, "/"));
	return Array.from(GENERATED_CONTEXT_HOOK_FILENAMES).some(
		(hookName) => normalized === hookName || normalized.endsWith(`-${hookName}`),
	);
}

// Settings entries usually contain full commands, sometimes through wrappers; substring
// matching intentionally catches those broader references while the basename classifier
// above handles discovered item names and registry paths.
export function referencesGeneratedContextHook(value: string): boolean {
	const normalized = value.replace(/\\/g, "/");
	return Array.from(GENERATED_CONTEXT_HOOK_FILENAMES).some((name) => normalized.includes(name));
}
