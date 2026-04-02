import type { SectionConfig } from "@/types/statusline-types";
/**
 * Compact draggable chip for a single statusline section.
 * Click to expand inline settings (icon, label, color, maxWidth).
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";

interface StatuslineSectionChipProps {
	sectionId: string;
	label: string;
	config: SectionConfig;
	onConfigChange: (config: SectionConfig) => void;
	isDragging?: boolean;
}

export const StatuslineSectionChip: React.FC<StatuslineSectionChipProps> = ({
	sectionId,
	label,
	config,
	onConfigChange,
}) => {
	const { t } = useI18n();
	const [expanded, setExpanded] = useState(false);

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: sectionId,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
		zIndex: isDragging ? 50 : undefined,
	};

	const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onConfigChange({ ...config, icon: e.target.value || undefined });
	};

	const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onConfigChange({ ...config, label: e.target.value || undefined });
	};

	const handleMaxWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseInt(e.target.value, 10);
		// Clamp to UI range [10, 200] to prevent out-of-range typed values
		onConfigChange({
			...config,
			maxWidth: Number.isNaN(val) ? undefined : Math.max(10, Math.min(200, val)),
		});
	};

	const displayIcon = config.icon ?? "";
	const displayLabel = config.label ?? label;

	return (
		<div ref={setNodeRef} style={style} className="relative">
			{/* Chip button */}
			<div
				className={`group flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer select-none transition-all ${
					isDragging
						? "border-dash-accent bg-dash-accent/20 shadow-lg"
						: "border-dash-border bg-dash-surface hover:border-dash-accent/60 hover:bg-dash-surface-hover"
				}`}
			>
				{/* Drag handle area */}
				<span
					{...attributes}
					{...listeners}
					className="text-dash-text-muted cursor-grab active:cursor-grabbing shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
					aria-label="drag handle"
				>
					⠿
				</span>

				{/* Icon + label — click to expand settings */}
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="flex items-center gap-1 text-xs text-dash-text min-w-0"
					aria-label={expanded ? t("statuslineCollapseSettings") : t("statuslineExpandSettings")}
				>
					{displayIcon && <span className="shrink-0">{displayIcon}</span>}
					<span className="truncate max-w-[80px]">{displayLabel}</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className={`w-3 h-3 shrink-0 text-dash-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</div>

			{/* Inline settings popover */}
			{expanded && (
				<div className="absolute top-full left-0 z-20 mt-1 w-56 p-3 rounded-lg border border-dash-border bg-dash-surface shadow-xl space-y-2">
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label
								htmlFor={`chip-icon-${sectionId}`}
								className="block text-[10px] font-medium text-dash-text-muted mb-1"
							>
								{t("statuslineIconOverride")}
							</label>
							<input
								id={`chip-icon-${sectionId}`}
								type="text"
								value={config.icon ?? ""}
								onChange={handleIconChange}
								placeholder={t("statuslineIconPlaceholder")}
								maxLength={20}
								className="w-full text-xs px-2 py-1 rounded border border-dash-border bg-dash-bg text-dash-text placeholder-dash-text-muted focus:outline-none focus:border-dash-accent"
							/>
						</div>
						<div>
							<label
								htmlFor={`chip-label-${sectionId}`}
								className="block text-[10px] font-medium text-dash-text-muted mb-1"
							>
								{t("statuslineLabelOverride")}
							</label>
							<input
								id={`chip-label-${sectionId}`}
								type="text"
								value={config.label ?? ""}
								onChange={handleLabelChange}
								placeholder={label}
								maxLength={50}
								className="w-full text-xs px-2 py-1 rounded border border-dash-border bg-dash-bg text-dash-text placeholder-dash-text-muted focus:outline-none focus:border-dash-accent"
							/>
						</div>
					</div>
					<div>
						<label
							htmlFor={`chip-maxwidth-${sectionId}`}
							className="block text-[10px] font-medium text-dash-text-muted mb-1"
						>
							{t("statuslineMaxWidth")}
						</label>
						{/* UI cap at 200; schema allows up to 500 for advanced users editing JSON directly */}
						<input
							id={`chip-maxwidth-${sectionId}`}
							type="number"
							min={10}
							max={200}
							value={config.maxWidth ?? ""}
							onChange={handleMaxWidthChange}
							placeholder={t("statuslineMaxWidthPlaceholder")}
							className="w-full text-xs px-2 py-1 rounded border border-dash-border bg-dash-bg text-dash-text placeholder-dash-text-muted focus:outline-none focus:border-dash-accent"
						/>
					</div>
					<button
						type="button"
						onClick={() => setExpanded(false)}
						className="w-full text-[10px] py-0.5 text-dash-text-muted hover:text-dash-text transition-colors"
					>
						Close
					</button>
				</div>
			)}
		</div>
	);
};
