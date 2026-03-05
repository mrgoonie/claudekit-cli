/**
 * Kit and customization badges for skill cards/rows
 * Shared across skill-row, skill-card-grid, and skill-detail-panel
 */
import type React from "react";

/** Kit badge colors: orange for engineer, blue for marketing, gray fallback */
const KIT_COLORS: Record<string, string> = {
	engineer: "#F7A072",
	marketing: "#4A9BD9",
};

/** Small colored pill showing kit origin (Engineer/Marketing) */
export const KitBadge: React.FC<{ kit: string }> = ({ kit }) => {
	const color = KIT_COLORS[kit] || "#6B6560";
	const label = kit.charAt(0).toUpperCase() + kit.slice(1);
	return (
		<span
			className="text-[10px] font-semibold px-1.5 py-0.5 rounded-lg shrink-0"
			style={{ background: `${color}26`, color }}
		>
			{label}
		</span>
	);
};

/** Purple badge indicating project has customized this skill */
export const CustomizedBadge: React.FC<{ label: string }> = ({ label }) => (
	<span
		className="text-[10px] font-semibold px-1.5 py-0.5 rounded-lg shrink-0"
		style={{ background: "#9B59B626", color: "#9B59B6" }}
	>
		{label}
	</span>
);
