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
import type { ResolvedWorkflow } from "../../types/workflow-types";
import { createGraphFromWorkflow } from "./workflow-graph-utils";
import { WorkflowSkillNode } from "./workflow-skill-node";

interface MiniGraphProps {
	workflow: ResolvedWorkflow;
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
		<div className="w-full h-full min-h-[400px] rounded-xl border border-gray-200 dark:border-dash-border overflow-hidden bg-gray-50 dark:bg-[#111216] relative">
			<svg style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0 }}>
				<defs>
					<linearGradient id="edge-grad-0" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#fb7185" />
						<stop offset="100%" stopColor="#fbbf24" />
					</linearGradient>
					<linearGradient id="edge-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#fbbf24" />
						<stop offset="100%" stopColor="#34d399" />
					</linearGradient>
					<linearGradient id="edge-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#34d399" />
						<stop offset="100%" stopColor="#22d3ee" />
					</linearGradient>
					<linearGradient id="edge-grad-3" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#22d3ee" />
						<stop offset="100%" stopColor="#a78bfa" />
					</linearGradient>
					<linearGradient id="edge-grad-4" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#a78bfa" />
						<stop offset="100%" stopColor="#e879f9" />
					</linearGradient>
					<linearGradient id="edge-grad-5" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#e879f9" />
						<stop offset="100%" stopColor="#fb7185" />
					</linearGradient>
				</defs>
			</svg>
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
