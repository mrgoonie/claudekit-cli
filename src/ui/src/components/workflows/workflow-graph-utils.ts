import type { Node, Edge } from '@xyflow/react';
import type { Workflow } from '../../types/workflow-types';

export function createGraphFromWorkflow(workflow: Workflow) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const startX = 50;
  const startY = 100;
  const xSpacing = 280;

  workflow.steps.forEach((step, index) => {
    nodes.push({
      id: step.id,
      type: 'skillNode',
      position: { x: startX + index * xSpacing, y: startY },
      data: {
        step,
        category: workflow.category
      }
    });

    if (index < workflow.steps.length - 1) {
      edges.push({
        id: `e-${step.id}-${workflow.steps[index + 1].id}`,
        source: step.id,
        target: workflow.steps[index + 1].id,
        label: step.transitionLabel || '',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 }
      });
    }
  });

  return { nodes, edges };
}
