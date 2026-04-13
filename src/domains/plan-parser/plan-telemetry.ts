/**
 * Plan Telemetry Stub
 * Future: Send anonymous usage analytics to ClaudeKit backend
 * Current: No-op, debug logging only when CK_TELEMETRY=1
 */

export interface PlanEvent {
	event: "plan_created" | "plan_completed" | "phase_checked" | "phase_unchecked";
	planDir: string;
	timestamp: string;
	source: "skill" | "cli" | "dashboard";
	metadata?: Record<string, unknown>;
}

/**
 * Track a plan event. Currently a no-op stub.
 * @future When CK_TELEMETRY backend is ready, this will send events.
 */
export function trackPlanEvent(event: PlanEvent): void {
	try {
		// Debug mode: log to stderr when enabled so JSON stdout output stays valid.
		if (process.env.CK_TELEMETRY === "1") {
			process.stderr.write(`[telemetry] ${JSON.stringify(event)}\n`);
		}

		// TODO: Future implementation
		// if (process.env.CK_TELEMETRY_ENDPOINT) {
		//   fetch(process.env.CK_TELEMETRY_ENDPOINT, {
		//     method: "POST",
		//     body: JSON.stringify(event),
		//   }).catch(() => {}); // Fire and forget
		// }
	} catch {
		// Telemetry is strictly best-effort.
	}
}

/**
 * Track plan creation
 */
export function trackPlanCreated(planDir: string, source: PlanEvent["source"]): void {
	trackPlanEvent({
		event: "plan_created",
		planDir,
		timestamp: new Date().toISOString(),
		source,
	});
}

/**
 * Track plan completion (all phases done)
 */
export function trackPlanCompleted(planDir: string, source: PlanEvent["source"]): void {
	trackPlanEvent({
		event: "plan_completed",
		planDir,
		timestamp: new Date().toISOString(),
		source,
	});
}

/**
 * Track phase status change to completed
 */
export function trackPhaseChecked(
	planDir: string,
	phaseId: string,
	source: PlanEvent["source"],
): void {
	trackPlanEvent({
		event: "phase_checked",
		planDir,
		timestamp: new Date().toISOString(),
		source,
		metadata: { phaseId },
	});
}

/**
 * Track phase status change to pending (unchecked)
 */
export function trackPhaseUnchecked(
	planDir: string,
	phaseId: string,
	source: PlanEvent["source"],
): void {
	trackPlanEvent({
		event: "phase_unchecked",
		planDir,
		timestamp: new Date().toISOString(),
		source,
		metadata: { phaseId },
	});
}
