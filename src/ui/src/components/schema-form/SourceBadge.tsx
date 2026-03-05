/**
 * SourceBadge - Shows config value source (default/project/global)
 */
import type React from "react";
import { useI18n } from "../../i18n";

export type ConfigSource = "default" | "project" | "global";

interface SourceBadgeProps {
	source: ConfigSource;
}

const SOURCE_STYLES: Record<ConfigSource, string> = {
	default: "bg-gray-500/10 text-gray-500 dark:bg-gray-400/10 dark:text-gray-400",
	project: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
	global: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
	const { t } = useI18n();

	// Map source to translation key
	const getLabel = (): string => {
		switch (source) {
			case "default":
				return t("default");
			case "project":
				return t("scopeProject");
			case "global":
				return t("scopeGlobal");
		}
	};

	return (
		<span
			className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${SOURCE_STYLES[source]}`}
		>
			{getLabel()}
		</span>
	);
};
