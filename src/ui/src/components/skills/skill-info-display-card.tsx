import type { AgentInfo, SkillInfo, SkillInstallation } from "@/types";
/**
 * Skill card component displaying skill info with installation status
 */
import type React from "react";
import { useI18n } from "../../i18n";
import SkillStatusBadge from "./skill-status-badge";

interface SkillCardProps {
	skill: SkillInfo;
	installations: SkillInstallation[];
	agents: AgentInfo[];
	onInstall: () => void;
	onUninstall: (agent: string) => void;
}

const SkillCard: React.FC<SkillCardProps> = ({
	skill,
	installations,
	agents,
	onInstall,
	onUninstall,
}) => {
	const { t } = useI18n();

	// Find installations for this skill
	const skillInstallations = installations.filter((i) => i.skillName === skill.name);
	const isInstalled = skillInstallations.length > 0;

	// Create map of agent -> installation
	const installMap = new Map(skillInstallations.map((i) => [i.agent, i]));

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg p-4 hover:border-dash-accent/30 transition-colors">
			{/* Header */}
			<div className="flex items-start justify-between gap-3 mb-3">
				<div className="flex-1 min-w-0">
					<h3 className="text-base font-semibold text-dash-text truncate">{skill.name}</h3>
					<p className="text-xs text-dash-text-muted mt-1">
						{skill.description || t("noDescription")}
					</p>
				</div>
				<span className="px-2 py-1 text-xs font-medium bg-dash-surface-hover text-dash-text-secondary rounded shrink-0">
					{skill.category}
				</span>
			</div>

			{/* Agent status badges */}
			<div className="flex flex-wrap gap-2 mb-3">
				{agents.map((agent) => {
					const installation = installMap.get(agent.name);
					return (
						<SkillStatusBadge
							key={agent.name}
							agent={agent.displayName}
							installed={!!installation}
							isGlobal={installation?.isGlobal}
						/>
					);
				})}
			</div>

			{/* Action button */}
			<button
				type="button"
				onClick={isInstalled ? () => onUninstall(skillInstallations[0].agent) : onInstall}
				disabled={!skill.isAvailable}
				className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
					isInstalled
						? "bg-dash-surface-hover text-dash-text border border-dash-border hover:bg-dash-bg"
						: "bg-dash-accent text-white hover:bg-dash-accent/90"
				} disabled:opacity-50 disabled:cursor-not-allowed`}
			>
				{isInstalled ? "Manage" : "Install"}
			</button>
		</div>
	);
};

export default SkillCard;
