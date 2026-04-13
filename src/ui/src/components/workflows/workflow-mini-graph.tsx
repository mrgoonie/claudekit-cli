import React, { useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Background
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Workflow } from '../../types/workflow-types';
import { createGraphFromWorkflow } from './workflow-graph-utils';
import { WorkflowSkillNode } from './workflow-skill-node';

interface MiniGraphProps {
  workflow: Workflow;
}

const nodeTypes = {
  skillNode: WorkflowSkillNode as any
};

export const WorkflowMiniGraph: React.FC<MiniGraphProps> = ({ workflow }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (workflow) {
      const { nodes: newNodes, edges: newEdges } = createGraphFromWorkflow(workflow);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [workflow, setNodes, setEdges]);

  const isDark = document.documentElement.classList.contains('dark');
  const proOptions = { hideAttribution: true };

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl border border-gray-200 dark:border-dash-border overflow-hidden bg-gray-50 dark:bg-[#111216]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        colorMode={isDark ? 'dark' : 'light'}
        proOptions={proOptions}
        panOnScroll={true}
        zoomOnScroll={false}
      >
        <Background color={isDark ? '#333' : '#eee'} gap={16} />
      </ReactFlow>
    </div>
  );
};
