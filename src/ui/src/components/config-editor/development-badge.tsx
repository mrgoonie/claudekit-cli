/**
 * DevelopmentBadge - Indicates feature is still under development
 */
import type React from "react";
import { useI18n } from "../../i18n";

export interface DevelopmentBadgeProps {
	variant?: "development" | "beta" | "experimental";
}

export const DevelopmentBadge: React.FC<DevelopmentBadgeProps> = ({ variant = "development" }) => {
	const { t } = useI18n();

	const labels = {
		development: t("developmentFeature"),
		beta: t("betaFeature"),
		experimental: t("experimentalFeature"),
	};

	return (
		<span className="text-[9px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-bold border border-orange-500/30 uppercase tracking-wider">
			{labels[variant]}
		</span>
	);
};
