import { useCallback, useEffect, useMemo, useState } from "react";
import { toRelativePlanPath } from "../components/plans/plan-path-utils";
import type { PlanNavigationState } from "../types/plan-dashboard-types";
import type { PlanPhase } from "../types/plan-types";

interface ParseResponse {
	frontmatter: Record<string, unknown>;
	phases: PlanPhase[];
}

function buildFilePath(rootDir: string, planSlug: string): string {
	return `${rootDir}/${planSlug}/plan.md`;
}

export function usePlanNavigation(
	rootDir: string,
	planSlug: string,
	phasePath?: string,
	projectId?: string | null,
): PlanNavigationState {
	const planDir = `${rootDir}/${planSlug}`;
	const [state, setState] = useState<PlanNavigationState>({
		planTitle: planSlug,
		phases: [],
		currentIndex: -1,
		prev: null,
		next: null,
		loading: true,
		error: null,
	});

	const load = useCallback(async () => {
		setState((current) => ({ ...current, loading: true, error: null }));
		try {
			const params = new URLSearchParams({
				file: buildFilePath(rootDir, planSlug),
			});
			if (projectId) {
				params.set("projectId", projectId);
			}
			const response = await fetch(`/api/plan/parse?${params.toString()}`);
			if (!response.ok) throw new Error(`Failed to load navigation (${response.status})`);
			const data = (await response.json()) as ParseResponse;
			setState({
				planTitle: typeof data.frontmatter.title === "string" ? data.frontmatter.title : planSlug,
				phases: data.phases.map((phase) => ({
					phaseId: phase.phaseId,
					name: phase.name,
					file: toRelativePlanPath(phase.file, planDir),
				})),
				currentIndex: -1,
				prev: null,
				next: null,
				loading: false,
				error: null,
			});
		} catch (err) {
			setState((current) => ({
				...current,
				loading: false,
				error: err instanceof Error ? err.message : "Failed to load navigation",
			}));
		}
	}, [planDir, planSlug, projectId, rootDir]);

	useEffect(() => {
		void load();
	}, [load]);

	return useMemo(() => {
		const currentIndex = phasePath
			? state.phases.findIndex((phase) => phase.file === phasePath)
			: -1;
		return {
			...state,
			currentIndex,
			prev: currentIndex > 0 ? state.phases[currentIndex - 1] : null,
			next:
				currentIndex >= 0
					? (state.phases[currentIndex + 1] ?? null)
					: state.phases.length > 0
						? state.phases[0]
						: null,
		};
	}, [phasePath, state]);
}
