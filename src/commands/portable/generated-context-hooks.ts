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
	"usage-quota-cache-refresh.cjs",
]);

export function isGeneratedContextHookName(name: string): boolean {
	const normalized = basename(name.replace(/\\/g, "/"));
	return Array.from(GENERATED_CONTEXT_HOOK_FILENAMES).some(
		(hookName) => normalized === hookName || normalized.endsWith(`-${hookName}`),
	);
}

export function referencesGeneratedContextHook(value: string): boolean {
	const normalized = value.replace(/\\/g, "/");
	return Array.from(GENERATED_CONTEXT_HOOK_FILENAMES).some((name) => normalized.includes(name));
}
