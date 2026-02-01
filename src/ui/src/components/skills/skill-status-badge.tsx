/**
 * Badge showing installation status for a specific agent
 */
import type React from "react";

interface SkillStatusBadgeProps {
	agent: string;
	installed: boolean;
	isGlobal?: boolean;
}

const SkillStatusBadge: React.FC<SkillStatusBadgeProps> = ({ agent, installed, isGlobal }) => {
	// Get first letter of agent name for badge
	const initial = agent.charAt(0).toUpperCase();

	return (
		<div
			className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
				installed
					? "bg-dash-accent/10 text-dash-accent border border-dash-accent/20"
					: "bg-dash-surface-hover text-dash-text-muted border border-dash-border"
			}`}
			title={`${agent}${isGlobal ? " (global)" : ""}`}
		>
			<span className="w-4 h-4 flex items-center justify-center rounded-full bg-current/10">
				{initial}
			</span>
			<span className="truncate max-w-20">{agent}</span>
			{isGlobal && <span className="text-[10px] opacity-70">(G)</span>}
		</div>
	);
};

export default SkillStatusBadge;
