/**
 * MetaBadge - Displays a label:value badge for field metadata
 */
import type React from "react";

export interface MetaBadgeProps {
	label: string;
	value: string;
}

export const MetaBadge: React.FC<MetaBadgeProps> = ({ label, value }) => (
	<div className="flex items-center gap-1.5 px-2 py-1 bg-dash-bg border border-dash-border rounded-md">
		<span className="text-[9px] font-bold text-dash-text-muted uppercase">{label}:</span>
		<span className="text-[10px] mono font-bold text-dash-text-secondary">{value}</span>
	</div>
);
