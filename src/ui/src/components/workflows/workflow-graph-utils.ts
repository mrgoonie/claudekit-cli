import type { Edge, Node } from "@xyflow/react";
import type { ResolvedWorkflow } from "../../types/workflow-types";

export function createGraphFromWorkflow(workflow: ResolvedWorkflow) {
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const startX = 50;
	const startY = 100;
	const xSpacing = 280;

	workflow.steps.forEach((step, index) => {
		nodes.push({
			id: step.id,
			type: "skillNode",
			position: { x: startX + index * xSpacing, y: startY },
			data: {
				step,
				category: workflow.category,
				index,
			},
		});

		if (index < workflow.steps.length - 1) {
			edges.push({
				id: `e-${step.id}-${workflow.steps[index + 1].id}`,
				source: step.id,
				target: workflow.steps[index + 1].id,
				label: step.transitionLabel || "",
				animated: true,
				style: {
					stroke: `url(#edge-grad-${index % 6})`,
					strokeWidth: 3,
					filter: "drop-shadow(0px 0px 3px rgba(100,100,100,0.15))",
				},
			});
		}
	});

	return { nodes, edges };
}
