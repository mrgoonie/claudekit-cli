import { useMemo, useState } from "react";
import type {
	ResolvedWorkflow,
	WorkflowCategory,
	WorkflowComplexity,
} from "../types/workflow-types";
import { useWorkflowsEnhanced } from "./use-workflows-enhanced";

export function useWorkflows() {
	const [activeCategory, setActiveCategory] = useState<WorkflowCategory | "all">("all");
	const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
	const { workflows: allWorkflows, loading, error, resolveSkillName } = useWorkflowsEnhanced();

	const filteredWorkflows = useMemo(() => {
		let result: ResolvedWorkflow[] = allWorkflows;
		if (activeCategory !== "all") {
			result = allWorkflows.filter((w) => w.category === activeCategory);
		}

		const complexityWeight: Record<WorkflowComplexity, number> = {
			beginner: 0,
			intermediate: 1,
			advanced: 2,
		};

		return [...result].sort(
			(a, b) => complexityWeight[a.complexity] - complexityWeight[b.complexity],
		);
	}, [activeCategory, allWorkflows]);

	return {
		workflows: filteredWorkflows,
		activeCategory,
		setActiveCategory,
		selectedWorkflowId,
		setSelectedWorkflowId,
		loading,
		error,
		resolveSkillName,
	};
}
