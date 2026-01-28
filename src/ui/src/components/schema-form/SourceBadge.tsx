/**
 * SourceBadge - Shows config value source (default/project/global)
 */
import type React from "react";

export type ConfigSource = "default" | "project" | "global";

interface SourceBadgeProps {
	source: ConfigSource;
}

const SOURCE_STYLES: Record<ConfigSource, string> = {
	default: "bg-gray-500/10 text-gray-500 dark:bg-gray-400/10 dark:text-gray-400",
	project: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
	global: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const SOURCE_LABELS: Record<ConfigSource, string> = {
	default: "default",
	project: "project",
	global: "global",
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
	return (
		<span
			className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${SOURCE_STYLES[source]}`}
		>
			{SOURCE_LABELS[source]}
		</span>
	);
};
