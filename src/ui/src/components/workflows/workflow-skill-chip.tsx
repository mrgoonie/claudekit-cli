import type React from "react";
import { useNavigate } from "react-router-dom";

interface SkillChipProps {
	command: string;
}

export const WorkflowSkillChip: React.FC<SkillChipProps> = ({ command }) => {
	const navigate = useNavigate();

	// Parse skill name from command, e.g., "/ck:plan" -> "plan"
	const skillMatch = command.match(/\/ck:([a-z0-9-]+)/i);
	const skillName = skillMatch ? skillMatch[1] : command.replace("/", "");

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		navigate(`/skills?name=${skillName}`);
	};

	return (
		<button
			onClick={handleClick}
			className="inline-flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-[#2A2E38] dark:hover:bg-[#323642] text-gray-800 dark:text-gray-200 text-xs font-mono rounded border border-gray-200 dark:border-gray-700 transition-colors"
			title={`View ${skillName} skill`}
		>
			{command}
		</button>
	);
};
