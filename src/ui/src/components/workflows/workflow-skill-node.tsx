import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type React from "react";
import type { ResolvedWorkflowStep, WorkflowCategory } from "../../types/workflow-types";

export type SkillNode = Node<
	{ step: ResolvedWorkflowStep; category: WorkflowCategory; index: number },
	"skillNode"
>;

const COLOR_VARIANTS = [
	{
		border: "border-rose-500 shadow-rose-500/20",
		gradient: "from-rose-400 to-orange-500",
		handle: "border-rose-500 dark:border-rose-400 bg-rose-500",
		badge:
			"bg-rose-50/80 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400",
	},
	{
		border: "border-amber-500 shadow-amber-500/20",
		gradient: "from-amber-400 to-yellow-500",
		handle: "border-amber-500 dark:border-amber-400 bg-amber-500",
		badge:
			"bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
	},
	{
		border: "border-emerald-500 shadow-emerald-500/20",
		gradient: "from-emerald-400 to-teal-500",
		handle: "border-emerald-500 dark:border-emerald-400 bg-emerald-500",
		badge:
			"bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
	},
	{
		border: "border-cyan-500 shadow-cyan-500/20",
		gradient: "from-cyan-400 to-blue-500",
		handle: "border-cyan-500 dark:border-cyan-400 bg-cyan-500",
		badge:
			"bg-cyan-50/80 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-400",
	},
	{
		border: "border-violet-500 shadow-violet-500/20",
		gradient: "from-violet-400 to-purple-500",
		handle: "border-violet-500 dark:border-violet-400 bg-violet-500",
		badge:
			"bg-violet-50/80 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400",
	},
	{
		border: "border-fuchsia-500 shadow-fuchsia-500/20",
		gradient: "from-fuchsia-400 to-pink-500",
		handle: "border-fuchsia-500 dark:border-fuchsia-400 bg-fuchsia-500",
		badge:
			"bg-fuchsia-50/80 dark:bg-fuchsia-500/10 border-fuchsia-200 dark:border-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400",
	},
];

export const WorkflowSkillNode: React.FC<NodeProps<SkillNode>> = ({ data, selected }) => {
	const idx = data.index ?? 0;
	const c = COLOR_VARIANTS[idx % COLOR_VARIANTS.length];

	return (
		<div
			className={`relative px-5 py-4 min-w-[220px] rounded-xl bg-white/80 dark:bg-[#14151a]/90 backdrop-blur-xl border transition-all duration-300 overflow-hidden ${selected ? `${c.border} scale-[1.02] z-10 shadow-lg` : "border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 z-0"}`}
			aria-label={`Workflow step: ${data.step.skill}`}
		>
			<div
				className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-[0.03] dark:opacity-10 pointer-events-none`}
			/>
			{/* Accent Strip */}
			<div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${c.gradient}`} />

			<Handle
				type="target"
				position={Position.Left}
				className={`w-3 h-3 -ml-[7px] rounded-full border-2 bg-white dark:bg-[#1C1F26] ${c.handle} ${selected ? "scale-110" : ""} transition-transform`}
			/>
			<div className="relative font-bold text-sm text-gray-900 dark:text-white capitalize truncate mb-1">
				{data.step.skill.replace(/-/g, " ")}
			</div>
			<div
				className={`relative text-xs font-mono px-2 py-1 rounded inline-block border ${c.badge}`}
			>
				{data.step.command}
			</div>
			<Handle
				type="source"
				position={Position.Right}
				className={`w-3 h-3 -mr-[7px] rounded-full border-2 bg-white dark:bg-[#1C1F26] ${c.handle} ${selected ? "scale-110" : ""} transition-transform`}
			/>
		</div>
	);
};
