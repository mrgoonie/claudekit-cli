import { useState } from "react";
import type { PlanActionResult } from "../types/plan-dashboard-types";
import type { PlanActionStatus } from "../types/plan-types";

async function pollAction(id: string): Promise<PlanActionStatus> {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const response = await fetch(`/api/plan/action/status?id=${encodeURIComponent(id)}`);
		if (!response.ok) throw new Error(`Failed to fetch action status (${response.status})`);
		const action = (await response.json()) as PlanActionStatus;
		if (action.status === "completed" || action.status === "failed") return action;
		await new Promise((resolve) => setTimeout(resolve, 300));
	}
	throw new Error("Timed out waiting for action to finish");
}

export function usePlanActions(): PlanActionResult {
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
					body: JSON.stringify(input),
				});
				if (!response.ok) throw new Error(`Failed to run action (${response.status})`);
				const action = (await response.json()) as PlanActionStatus;
				setPendingId(action.id);
				const finalAction =
					action.status === "completed" || action.status === "failed"
						? action
						: await pollAction(action.id);
				if (finalAction.status === "failed") {
					throw new Error(finalAction.error ?? "Action failed");
				}
				return finalAction;
			} catch (err) {
				const message = err instanceof Error ? err.message : "Action failed";
				setError(message);
				throw err;
			} finally {
				setLoading(false);
			}
		},
	};
}
