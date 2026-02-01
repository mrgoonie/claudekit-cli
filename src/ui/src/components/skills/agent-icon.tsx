/**
 * Agent brand icon using @lobehub/icons where available, fallback to initials
 */
import type React from "react";

import {
	Claude,
	Cline,
	Cursor,
	Gemini,
	GithubCopilot,
	Goose,
	OpenAI,
	Windsurf,
} from "@lobehub/icons";

/** Map agent internal name to lobehub color icon component */
const AGENT_ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
	"claude-code": Claude.Color,
	cursor: Cursor.Color,
	codex: OpenAI,
	"gemini-cli": Gemini.Color,
	goose: Goose.Color,
	"github-copilot": GithubCopilot.Color,
	windsurf: Windsurf.Color,
	cline: Cline.Color,
};

/** Map agent name to local image in /agents/ directory */
const AGENT_IMAGE_MAP: Record<string, string> = {
	antigravity: "/agents/antigravity.png",
};

/** Initials fallback for agents without lobehub icons */
function getInitials(displayName: string): string {
	return displayName
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

interface AgentIconProps {
	agentName: string;
	displayName: string;
	size?: number;
}

const AgentIcon: React.FC<AgentIconProps> = ({ agentName, displayName, size = 20 }) => {
	const IconComponent = AGENT_ICON_MAP[agentName];

	if (IconComponent) {
		return <IconComponent size={size} />;
	}

	// Check for local image asset
	const imageSrc = AGENT_IMAGE_MAP[agentName];
	if (imageSrc) {
		return (
			<img
				src={imageSrc}
				alt={displayName}
				className="rounded object-contain"
				style={{ width: size, height: size }}
			/>
		);
	}

	// Fallback: styled initials badge
	return (
		<div
			className="flex items-center justify-center rounded bg-dash-surface-hover text-dash-text-muted font-semibold"
			style={{ width: size, height: size, fontSize: size * 0.45 }}
		>
			{getInitials(displayName)}
		</div>
	);
};

export default AgentIcon;
