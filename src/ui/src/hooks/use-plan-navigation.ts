import { useCallback, useEffect, useState } from "react";
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
			const response = await fetch(
				`/api/plan/parse?file=${encodeURIComponent(buildFilePath(rootDir, planSlug))}`,
			);
			if (!response.ok) throw new Error(`Failed to load navigation (${response.status})`);
			const data = (await response.json()) as ParseResponse;
			const phases = data.phases.map((phase) => ({
				phaseId: phase.phaseId,
				name: phase.name,
				file: toRelativePlanPath(phase.file, planDir),
			}));
			const currentIndex = phasePath ? phases.findIndex((phase) => phase.file === phasePath) : -1;
			setState({
				planTitle: typeof data.frontmatter.title === "string" ? data.frontmatter.title : planSlug,
				phases,
				currentIndex,
				prev: currentIndex > 0 ? phases[currentIndex - 1] : null,
				next:
					currentIndex >= 0
						? (phases[currentIndex + 1] ?? null)
						: phases.length > 0
							? phases[0]
							: null,
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
	}, [phasePath, planDir, planSlug, rootDir]);

	useEffect(() => {
		void load();
	}, [load]);

	return state;
}
