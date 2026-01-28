/**
 * SchemaSection - Collapsible section containing related fields
 */
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";

interface SchemaSectionProps {
	id: string;
	title: string;
	titleVi?: string;
	defaultCollapsed?: boolean;
	children: React.ReactNode;
}

export const SchemaSection: React.FC<SchemaSectionProps> = ({
	id,
	title,
	titleVi,
	defaultCollapsed = false,
	children,
}) => {
	const { lang } = useI18n();
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

	const displayTitle = lang === "vi" && titleVi ? titleVi : title;

	return (
		<div className="bg-dash-surface border border-dash-border rounded-lg overflow-hidden">
			{/* Section header - clickable to toggle */}
			<button
				type="button"
				onClick={() => setIsCollapsed(!isCollapsed)}
				className="w-full flex items-center justify-between px-4 py-3 bg-dash-surface-hover/30 hover:bg-dash-surface-hover/50 transition-colors"
				aria-expanded={!isCollapsed}
				aria-controls={`section-${id}`}
			>
				<h3 className="text-sm font-bold text-dash-text uppercase tracking-wider">
					{displayTitle}
				</h3>
				<svg
					className={`w-4 h-4 text-dash-text-muted transition-transform duration-200 ${
						isCollapsed ? "" : "rotate-180"
					}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{/* Section content */}
			<div
				id={`section-${id}`}
				className={`transition-all duration-200 ease-in-out ${
					isCollapsed ? "max-h-0 overflow-hidden" : "max-h-[2000px]"
				}`}
			>
				<div className="px-4 py-2">{children}</div>
			</div>
		</div>
	);
};
