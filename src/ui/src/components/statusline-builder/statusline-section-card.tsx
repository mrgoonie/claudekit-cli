import type { StatuslineSection } from "@/types/statusline-types";
/**
 * Individual draggable section card for the statusline builder.
 * Shows section metadata, enabled toggle, and inline settings when expanded.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";

interface StatuslineSectionCardProps {
	section: StatuslineSection;
	label: string;
	description: string;
	onUpdate: (updated: StatuslineSection) => void;
	onToggle: (id: string, enabled: boolean) => void;
}

// Drag handle icon
const DragHandle: React.FC = () => (
	<div className="flex flex-col gap-0.5 cursor-grab active:cursor-grabbing text-dash-text-muted">
		<div className="flex gap-0.5">
			<span className="w-1 h-1 rounded-full bg-current" />
			<span className="w-1 h-1 rounded-full bg-current" />
		</div>
		<div className="flex gap-0.5">
			<span className="w-1 h-1 rounded-full bg-current" />
			<span className="w-1 h-1 rounded-full bg-current" />
		</div>
		<div className="flex gap-0.5">
			<span className="w-1 h-1 rounded-full bg-current" />
			<span className="w-1 h-1 rounded-full bg-current" />
		</div>
	</div>
);

export const StatuslineSectionCard: React.FC<StatuslineSectionCardProps> = ({
	section,
	label,
	description,
	onUpdate,
	onToggle,
}) => {
	const { t } = useI18n();
	const [expanded, setExpanded] = useState(false);

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: section.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 50 : undefined,
	};

	const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onUpdate({ ...section, icon: e.target.value || undefined });
	};

	const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onUpdate({ ...section, label: e.target.value || undefined });
	};

	const handleMaxWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseInt(e.target.value, 10);
		// Clamp to UI range [10, 200] to prevent out-of-range typed values
		onUpdate({
			...section,
			maxWidth: Number.isNaN(val) ? undefined : Math.max(10, Math.min(200, val)),
		});
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`rounded-lg border transition-all ${
				section.enabled
					? "border-dash-border bg-dash-surface"
					: "border-dash-border/50 bg-dash-surface/50 opacity-60"
			} ${isDragging ? "shadow-lg scale-[1.02]" : ""}`}
		>
			{/* Card header row */}
			<div className="flex items-center gap-3 p-3">
				{/* Drag handle */}
				<div {...attributes} {...listeners} className="shrink-0">
					<DragHandle />
				</div>

				{/* Icon */}
				<span className="text-lg shrink-0 w-7 text-center">{section.icon ?? "◾"}</span>

				{/* Label + description */}
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-dash-text truncate">{label}</p>
					<p className="text-xs text-dash-text-muted truncate">{description}</p>
				</div>

				{/* Expand toggle */}
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="shrink-0 w-6 h-6 flex items-center justify-center text-dash-text-muted hover:text-dash-text rounded transition-colors"
					aria-label={expanded ? t("statuslineCollapseSettings") : t("statuslineExpandSettings")}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{/* Enabled toggle */}
				<button
					type="button"
					onClick={() => onToggle(section.id, !section.enabled)}
					className={`shrink-0 w-10 h-5 rounded-full relative transition-colors ${
						section.enabled ? "bg-dash-accent" : "bg-dash-border"
					}`}
					aria-label={section.enabled ? t("statuslineDisable") : t("statuslineEnable")}
				>
					<span
						className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
							section.enabled ? "translate-x-5" : "translate-x-0"
						}`}
					/>
				</button>
			</div>

			{/* Inline settings (expanded) */}
			{expanded && (
				<div className="px-3 pb-3 border-t border-dash-border/50 pt-3 space-y-3">
					<div className="grid grid-cols-2 gap-3">
						{/* Icon override */}
						<div>
							<label
								htmlFor={`${section.id}-icon`}
								className="block text-xs font-medium text-dash-text-muted mb-1"
							>
								{t("statuslineIconOverride")}
							</label>
							<input
								id={`${section.id}-icon`}
								type="text"
								value={section.icon ?? ""}
								onChange={handleIconChange}
								placeholder={t("statuslineIconPlaceholder")}
								maxLength={20}
								className="w-full text-sm px-2 py-1.5 rounded border border-dash-border bg-dash-bg text-dash-text placeholder-dash-text-muted focus:outline-none focus:border-dash-accent"
							/>
						</div>
						{/* Label override */}
						<div>
							<label
								htmlFor={`${section.id}-label`}
								className="block text-xs font-medium text-dash-text-muted mb-1"
							>
								{t("statuslineLabelOverride")}
							</label>
							<input
								id={`${section.id}-label`}
								type="text"
								value={section.label ?? ""}
								onChange={handleLabelChange}
								placeholder={label}
								maxLength={50}
								className="w-full text-sm px-2 py-1.5 rounded border border-dash-border bg-dash-bg text-dash-text placeholder-dash-text-muted focus:outline-none focus:border-dash-accent"
							/>
						</div>
					</div>
					{/* Max width */}
					<div>
						<label
							htmlFor={`${section.id}-maxwidth`}
							className="block text-xs font-medium text-dash-text-muted mb-1"
						>
							{t("statuslineMaxWidth")}
						</label>
						{/* UI cap at 200; schema allows up to 500 for advanced users editing JSON directly */}
						<input
							id={`${section.id}-maxwidth`}
							type="number"
							min={10}
							max={200}
							value={section.maxWidth ?? ""}
							onChange={handleMaxWidthChange}
							placeholder={t("statuslineMaxWidthPlaceholder")}
							className="w-full text-sm px-2 py-1.5 rounded border border-dash-border bg-dash-bg text-dash-text placeholder-dash-text-muted focus:outline-none focus:border-dash-accent"
						/>
					</div>
				</div>
			)}
		</div>
	);
};
