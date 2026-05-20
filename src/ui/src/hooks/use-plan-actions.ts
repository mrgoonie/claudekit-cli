import { useState } from "react";
import type { PlanActionResult } from "../types/plan-dashboard-types";
import type { PlanActionStatus } from "../types/plan-types";

export function usePlanActions(projectId?: string | null): PlanActionResult {
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	return {
		pendingId,
		loading,
		error,
		trigger: async (input) => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch("/api/plan/action", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						...input,
						...(projectId ? { projectId } : {}),
					}),
				});
				if (!response.ok) throw new Error(`Failed to run action (${response.status})`);
				const action = (await response.json()) as PlanActionStatus;
				setPendingId(action.id);
				if (action.status === "failed") {
					throw new Error(action.error ?? "Action failed");
				}
				return action;
			} catch (err) {
				const message = err instanceof Error ? err.message : "Action failed";
				setError(message);
				throw err;
			} finally {
				setPendingId(null);
				setLoading(false);
			}
		},
	};
}
