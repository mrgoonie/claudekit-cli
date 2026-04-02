import type { SectionConfig } from "@/types/statusline-types";
import { useDroppable } from "@dnd-kit/core";
/**
 * A single line zone in the statusline layout builder.
 * Contains sortable section chips for one line of the statusline.
 */
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import type React from "react";
import { useI18n } from "../../i18n";
import type { TranslationKey } from "../../i18n/translations";
import { StatuslineSectionChip } from "./statusline-section-chip";

/** Maps section id → i18n label key */
const SECTION_LABEL_KEYS: Record<string, TranslationKey> = {
	model: "statuslineSectionModelLabel",
	context: "statuslineSectionContextLabel",
	quota: "statuslineSectionQuotaLabel",
	directory: "statuslineSectionDirectoryLabel",
	git: "statuslineSectionGitLabel",
	cost: "statuslineSectionCostLabel",
	changes: "statuslineSectionChangesLabel",
	agents: "statuslineSectionAgentsLabel",
	todos: "statuslineSectionTodosLabel",
};

interface StatuslineLineZoneProps {
	/** Container id, e.g. "line-0", "line-1", or "pool" */
	containerId: string;
	/** Section IDs in this zone */
	sectionIds: string[];
	sectionConfig: Record<string, SectionConfig>;
	onConfigChange: (sectionId: string, config: SectionConfig) => void;
	/** Optional header label */
	headerLabel?: string;
	/** Show remove button */
	onRemove?: () => void;
	/** Muted/pool appearance */
	isPool?: boolean;
}

export const StatuslineLineZone: React.FC<StatuslineLineZoneProps> = ({
	containerId,
	sectionIds,
	sectionConfig,
	onConfigChange,
	headerLabel,
	onRemove,
	isPool = false,
}) => {
	const { t } = useI18n();

	const { setNodeRef, isOver } = useDroppable({ id: containerId });

	return (
		<div
			className={`rounded-lg border transition-colors ${
				isPool
					? "border-dash-border/50 bg-dash-bg/50"
					: isOver
						? "border-dash-accent/60 bg-dash-accent/5"
						: "border-dash-border bg-dash-surface"
			}`}
		>
			{/* Zone header */}
			{headerLabel && (
				<div className="flex items-center justify-between px-3 py-1.5 border-b border-dash-border/50">
					<span
						className={`text-xs font-medium uppercase tracking-wider ${
							isPool ? "text-dash-text-muted/70" : "text-dash-text-muted"
						}`}
					>
						{headerLabel}
					</span>
					{onRemove && (
						<button
							type="button"
							onClick={onRemove}
							className="text-xs text-dash-text-muted hover:text-red-400 transition-colors px-1"
							aria-label={t("statuslineRemoveLine")}
						>
							{t("statuslineRemoveLine")}
						</button>
					)}
				</div>
			)}

			{/* Drop zone with chips */}
			<div ref={setNodeRef} className="p-2 min-h-[44px]">
				<SortableContext items={sectionIds} strategy={horizontalListSortingStrategy}>
					<div className="flex flex-wrap gap-1.5">
						{sectionIds.length === 0 ? (
							<span className="text-xs text-dash-text-muted/50 italic px-1 py-0.5">
								{isPool ? t("statuslineDragToLine") : "—"}
							</span>
						) : (
							sectionIds.map((id) => (
								<StatuslineSectionChip
									key={id}
									sectionId={id}
									label={t(
										(SECTION_LABEL_KEYS[id] ?? "statuslineSectionModelLabel") as TranslationKey,
									)}
									config={sectionConfig[id] ?? {}}
									onConfigChange={(cfg) => onConfigChange(id, cfg)}
								/>
							))
						)}
					</div>
				</SortableContext>
			</div>
		</div>
	);
};
