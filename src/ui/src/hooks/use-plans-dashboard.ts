import { useCallback, useEffect, useState } from "react";
import type { PlanListItem, PlansListResponse } from "../types/plan-dashboard-types";

export function usePlansDashboard(rootDir: string, projectId?: string | null) {
	const [plans, setPlans] = useState<PlanListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({
				dir: rootDir,
				limit: "500",
				offset: "0",
			});
			if (projectId) {
				params.set("projectId", projectId);
			}
			const response = await fetch(`/api/plan/list?${params.toString()}`);
			if (!response.ok) throw new Error(`Failed to load plans (${response.status})`);
			const data = (await response.json()) as PlansListResponse;
			setPlans(data.plans ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load plans");
		} finally {
			setLoading(false);
		}
	}, [projectId, rootDir]);

	useEffect(() => {
		void load();
	}, [load]);

	return { plans, loading, error, reload: load };
}
