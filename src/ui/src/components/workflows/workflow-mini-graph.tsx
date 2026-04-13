import {
	Background,
	type Edge,
	type Node,
	type NodeTypes,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { Workflow } from "../../types/workflow-types";
import { createGraphFromWorkflow } from "./workflow-graph-utils";
import { WorkflowSkillNode } from "./workflow-skill-node";

interface MiniGraphProps {
	workflow: Workflow;
}

/**
 * Custom hook to reactively track dark mode state
 * Uses MutationObserver to watch for class changes on document.documentElement
 */
function useDarkMode(): boolean {
	const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

	useEffect(() => {
		const observer = new MutationObserver(() => {
			setIsDark(document.documentElement.classList.contains("dark"));
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	return isDark;
}

export const WorkflowMiniGraph: React.FC<MiniGraphProps> = ({ workflow }) => {
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const isDark = useDarkMode();

	// Memoize nodeTypes to prevent unnecessary re-renders
	const nodeTypes: NodeTypes = useMemo(
		() => ({
			skillNode: WorkflowSkillNode,
		}),
		[],
	);

	useEffect(() => {
		if (workflow) {
			const { nodes: newNodes, edges: newEdges } = createGraphFromWorkflow(workflow);
			setNodes(newNodes);
			setEdges(newEdges);
		}
	}, [workflow, setNodes, setEdges]);

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
				colorMode={isDark ? "dark" : "light"}
				proOptions={proOptions}
				panOnScroll={true}
				zoomOnScroll={false}
			>
				<Background color={isDark ? "#333" : "#eee"} gap={16} />
			</ReactFlow>
		</div>
	);
};
