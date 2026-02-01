import type { AgentInfo, SkillInfo, SkillInstallation } from "@/types";
/**
 * Skill card component for grid view - compact card layout
 */
import type React from "react";
import { useI18n } from "../../i18n";
import { CATEGORY_COLORS } from "../../types/skills-dashboard-types";
import { CustomizedBadge, KitBadge } from "./metadata-badges";

interface SkillCardGridProps {
	skill: SkillInfo;
	installations: SkillInstallation[];
	agents: AgentInfo[];
	onClick: () => void;
}

const SkillCardGrid: React.FC<SkillCardGridProps> = ({ skill, installations, agents, onClick }) => {
	const { t } = useI18n();

	// Find installations for this skill (match by id, the directory name)
	const skillInstallations = installations.filter((i) => i.skillName === skill.id);
	const isInstalled = skillInstallations.length > 0;

	// Get detected agents only
	const detectedAgents = agents.filter((a) => a.detected);
	const installMap = new Map(skillInstallations.map((i) => [i.agent, i]));

	// Display first 3 agents
	const displayAgents = detectedAgents.slice(0, 3);

	const categoryColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.General;

	return (
		<div
			onClick={onClick}
			className="bg-dash-surface border border-transparent rounded-lg p-4 cursor-pointer transition-all hover:border-dash-border hover:shadow-lg hover:-translate-y-0.5 flex flex-col gap-2.5"
		>
			{/* Header */}
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="text-sm font-semibold text-dash-text truncate">{skill.name}</div>
					{/* Kit + customized badges */}
					{(skill.kit || skill.isCustomized) && (
						<div className="flex items-center gap-1 mt-1">
							{skill.kit && <KitBadge kit={skill.kit} />}
							{skill.isCustomized && <CustomizedBadge label={t("customizedBadge")} />}
						</div>
					)}
				</div>
				<span
					className="text-[10px] font-semibold px-2 py-0.5 rounded-xl shrink-0"
					style={{
						background: `${categoryColor}26`,
						color: categoryColor,
					}}
				>
					{skill.category}
				</span>
			</div>

			{/* Description */}
			<p className="text-xs text-dash-text-muted leading-relaxed line-clamp-2 min-h-[2.5rem]">
				{skill.description || t("noDescription")}
			</p>

			{/* Footer */}
			<div className="flex items-center justify-between mt-auto pt-2">
				{/* Agent avatars */}
				<div className="flex gap-0.5">
					{displayAgents.map((agent) => {
						const installation = installMap.get(agent.name);
						const initial = agent.displayName.charAt(0).toUpperCase();
						return (
							<div
								key={agent.name}
								title={`${agent.displayName}${installation ? " (installed)" : ""}`}
								className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold border ${
									installation
										? "bg-dash-accent/10 text-dash-accent border-dash-accent/30"
										: "bg-dash-surface-hover text-dash-text-muted border-dash-border"
								}`}
							>
								{initial}
							</div>
						);
					})}
				</div>

				{/* Install button */}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onClick();
					}}
					className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors ${
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

export default SkillCardGrid;
