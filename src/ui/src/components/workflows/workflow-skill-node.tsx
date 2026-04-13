import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type React from "react";
import type { WorkflowCategory, WorkflowStep } from "../../types/workflow-types";

export type SkillNode = Node<{ step: WorkflowStep; category: WorkflowCategory }, "skillNode">;

export const WorkflowSkillNode: React.FC<NodeProps<SkillNode>> = ({ data, selected }) => {
	return (
		<div
			className={`px-4 py-3 shadow-md rounded-lg bg-white border-2 dark:bg-[#1C1F26] min-w-[200px] transition-all ${selected ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-gray-200 dark:border-gray-700"}`}
		>
			<Handle
				type="target"
				position={Position.Left}
				className="w-2 h-2 rounded-full border-2 bg-blue-500 border-white dark:border-[#1C1F26]"
			/>
			<div className="font-bold text-sm text-gray-800 dark:text-gray-200 capitalize">
				{data.step.skill.replace(/-/g, " ")}
			</div>
			<div className="text-xs text-gray-500 font-mono mt-2 bg-gray-100 dark:bg-[#2A2E38] dark:text-gray-300 p-1 rounded inline-block">
				{data.step.command}
			</div>
			<Handle
				type="source"
				position={Position.Right}
				className="w-2 h-2 rounded-full border-2 bg-blue-500 border-white dark:border-[#1C1F26]"
			/>
		</div>
	);
};
