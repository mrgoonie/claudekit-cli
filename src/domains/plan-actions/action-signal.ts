import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

const SIGNAL_DIR = join(process.cwd(), ".claude", "plan-actions");
const LATEST_SIGNAL_FILE = join(SIGNAL_DIR, "latest.json");

export function getActionSignalPath(id: string): string {
	return join(SIGNAL_DIR, `${id}.json`);
}

export function readActionSignal(id?: string): PlanAction | null {
	const target = id ? getActionSignalPath(id) : LATEST_SIGNAL_FILE;
	if (!existsSync(target)) return null;
	try {
		return JSON.parse(readFileSync(target, "utf8")) as PlanAction;
	} catch {
		return null;
	}
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
	mkdirSync(SIGNAL_DIR, { recursive: true });
	writeFileSync(getActionSignalPath(action.id), JSON.stringify(action, null, 2));
	writeFileSync(LATEST_SIGNAL_FILE, JSON.stringify(action, null, 2));
	return action;
}

export function updateActionStatus(
	id: string,
	status: PlanActionStatus,
	result?: Record<string, unknown>,
	error?: string,
): PlanAction | null {
	const current = readActionSignal(id);
	if (!current) return null;
	const next: PlanAction = { ...current, status, result, error };
	writeFileSync(getActionSignalPath(id), JSON.stringify(next, null, 2));
	writeFileSync(LATEST_SIGNAL_FILE, JSON.stringify(next, null, 2));
	return next;
}
