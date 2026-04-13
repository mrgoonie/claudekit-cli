export type PlanActionKind = "complete" | "start" | "reset" | "validate" | "start-next";
export type PlanActionStatus = "pending" | "processing" | "completed" | "failed";

export interface PlanAction {
	id: string;
	action: PlanActionKind;
	planDir: string;
	phaseId?: string;
	timestamp: string;
	status: PlanActionStatus;
	result?: Record<string, unknown>;
	error?: string;
}

const SIGNAL_TTL_MS = 60_000;
const actionStore = new Map<string, PlanAction>();
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleCleanup(id: string): void {
	const existingTimer = cleanupTimers.get(id);
	if (existingTimer) clearTimeout(existingTimer);
	const timer = setTimeout(() => {
		actionStore.delete(id);
		cleanupTimers.delete(id);
	}, SIGNAL_TTL_MS);
	timer.unref?.();
	cleanupTimers.set(id, timer);
}

export function readActionSignal(id: string): PlanAction | null {
	return actionStore.get(id) ?? null;
}

export function writeActionSignal(
	input: Pick<PlanAction, "action" | "planDir" | "phaseId">,
): PlanAction {
	const action: PlanAction = {
		id: crypto.randomUUID(),
		action: input.action,
		planDir: input.planDir,
		phaseId: input.phaseId,
		timestamp: new Date().toISOString(),
		status: "pending",
	};
	actionStore.set(action.id, action);
	scheduleCleanup(action.id);
	return action;
}

export function updateActionStatus(
	id: string,
	status: PlanActionStatus,
	result?: Record<string, unknown>,
	error?: string,
): PlanAction | null {
	const current = actionStore.get(id);
	if (!current) return null;
	const next: PlanAction = { ...current, status, result, error };
	actionStore.set(id, next);
	scheduleCleanup(id);
	return next;
}

export function clearActionStore(): void {
	for (const timer of cleanupTimers.values()) {
		clearTimeout(timer);
	}
	cleanupTimers.clear();
	actionStore.clear();
}
