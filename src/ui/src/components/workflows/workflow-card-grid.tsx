import type React from "react";
import type { ResolvedWorkflow } from "../../types/workflow-types";
import { WorkflowCard } from "./workflow-card";

interface GridProps {
	workflows: ResolvedWorkflow[];
	selectedWorkflowId: string | null;
	onSelectWorkflow: (id: string | null) => void;
}

export const WorkflowCardGrid: React.FC<GridProps> = ({
	workflows,
	selectedWorkflowId,
	onSelectWorkflow,
}) => {
	return (
		<div
			className={`grid gap-6 ${selectedWorkflowId ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}
		>
			{workflows
				.filter((w) => !selectedWorkflowId || w.id === selectedWorkflowId)
				.map((workflow) => (
					<WorkflowCard
						key={workflow.id}
						workflow={workflow}
						isSelected={selectedWorkflowId === workflow.id}
						onClick={() =>
							onSelectWorkflow(selectedWorkflowId === workflow.id ? null : workflow.id)
						}
					/>
				))}
		</div>
	);
};
