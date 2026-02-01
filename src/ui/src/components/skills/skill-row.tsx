import type { AgentInfo, SkillInfo, SkillInstallation } from "@/types";
/**
 * Skill row component for list view - compact horizontal layout
 */
import type React from "react";
import { useI18n } from "../../i18n";
import { CATEGORY_COLORS } from "../../types/skills-dashboard-types";
import AgentIcon from "./agent-icon";

interface SkillRowProps {
	skill: SkillInfo;
	installations: SkillInstallation[];
	agents: AgentInfo[];
	onClick: () => void;
}

const SkillRow: React.FC<SkillRowProps> = ({ skill, installations, agents, onClick }) => {
	const { t } = useI18n();

	// Find installations for this skill
	const skillInstallations = installations.filter((i) => i.skillName === skill.name);
	const isInstalled = skillInstallations.length > 0;

	// Get detected agents only
	const detectedAgents = agents.filter((a) => a.detected);

	// Get installation map for detected agents
	const installMap = new Map(skillInstallations.map((i) => [i.agent, i]));

	// Get first 3 detected agents for display
	const displayAgents = detectedAgents.slice(0, 3);
	const remainingCount = Math.max(0, detectedAgents.length - 3);

	return (
		<div
			onClick={onClick}
			className="grid grid-cols-[1fr_120px_200px_100px] items-center gap-4 px-4 py-2.5 bg-dash-surface border border-transparent rounded-lg cursor-pointer transition-all hover:border-dash-border hover:bg-dash-surface-hover"
		>
			{/* Name and description */}
			<div className="min-w-0">
				<div className="text-sm font-semibold text-dash-text truncate">{skill.name}</div>
				<div className="text-xs text-dash-text-muted truncate max-w-xs mt-0.5">
					{skill.description || t("noDescription")}
				</div>
			</div>

			{/* Category badge */}
			<div className="flex items-center gap-1.5 text-[11px] font-medium">
				<div
					className="w-1.5 h-1.5 rounded-full"
					style={{ background: CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.General }}
				/>
				<span className="text-dash-text-secondary">{skill.category}</span>
			</div>

			{/* Agent mini avatars (detected only) */}
			<div className="flex items-center gap-1">
				{displayAgents.map((agent) => {
					const installation = installMap.get(agent.name);
					return (
						<div
							key={agent.name}
							title={`${agent.displayName}${installation ? " (installed)" : ""}`}
							className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
								installation
									? "bg-dash-accent/10 border-dash-accent/30"
									: "bg-dash-surface-hover border-dash-border opacity-50"
							}`}
						>
							<AgentIcon agentName={agent.name} displayName={agent.displayName} size={14} />
						</div>
					);
				})}
				{remainingCount > 0 && (
					<span className="text-[10px] text-dash-text-muted ml-0.5">+{remainingCount}</span>
				)}
			</div>

			{/* Install/Manage button */}
			<div className="flex justify-end">
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onClick();
					}}
					className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
						isInstalled
							? "bg-transparent text-dash-text-secondary border border-dash-border hover:bg-dash-surface-hover"
							: "bg-dash-accent text-white hover:bg-dash-accent/90"
					}`}
				>
					{isInstalled ? t("manage") : t("install")}
				</button>
			</div>
		</div>
	);
};

export default SkillRow;
