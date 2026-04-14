import { useCallback, useEffect, useState } from "react";
import type {
	MultiProjectPlansResponse,
	PlanListItem,
	PlansListResponse,
	ProjectFilterOption,
	ProjectScanError,
} from "../types/plan-dashboard-types";

function flattenProjectPlans(response: MultiProjectPlansResponse): PlanListItem[] {
	return response.projects.flatMap((project) =>
		project.plans.map((plan) => ({
			...plan,
			projectId: project.id,
			projectName: project.name,
			plansDir: project.plansDir,
		})),
	);
}

export function usePlansDashboard(rootDir: string, projectId?: string | null) {
	const [plans, setPlans] = useState<PlanListItem[]>([]);
	const [projectOptions, setProjectOptions] = useState<ProjectFilterOption[]>([]);
	const [projectErrors, setProjectErrors] = useState<ProjectScanError[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			if (!projectId) {
				const response = await fetch("/api/plan/list-all");
				if (!response.ok) throw new Error(`Failed to load plans (${response.status})`);
				const data = (await response.json()) as MultiProjectPlansResponse;
				setProjectOptions(data.projects.map((project) => ({ id: project.id, name: project.name })));
				setProjectErrors(
					data.projects.flatMap((project) =>
						project.error ? [{ id: project.id, name: project.name, error: project.error }] : [],
					),
				);
				setPlans(flattenProjectPlans(data));
				return;
			}

			const params = new URLSearchParams({
				dir: rootDir,
				limit: "500",
				offset: "0",
				projectId,
			});
			const response = await fetch(`/api/plan/list?${params.toString()}`);
			if (!response.ok) throw new Error(`Failed to load plans (${response.status})`);
			const data = (await response.json()) as PlansListResponse;
			setProjectOptions([]);
			setProjectErrors([]);
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

	return { plans, projectOptions, projectErrors, loading, error, reload: load };
}
