import { ALL_SECTION_IDS, type SectionConfig } from "@/types/statusline-types";
/**
 * Lines-based statusline layout editor.
 * Renders each line as a horizontal zone with draggable section chips.
 * Hidden sections live in an "Available Sections" pool at the bottom.
 * Uses @dnd-kit multi-container DnD (one SortableContext per line + pool).
 */
import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type React from "react";
import { useState } from "react";
import { useI18n } from "../../i18n";
import { StatuslineLineZone } from "./statusline-line-zone";

interface StatuslineLineEditorProps {
	lines: string[][];
	sectionConfig: Record<string, SectionConfig>;
	onLinesChange: (lines: string[][]) => void;
	onSectionConfigChange: (config: Record<string, SectionConfig>) => void;
}

/** Resolve which container a section currently lives in */
function findContainer(lines: string[][], pool: string[], sectionId: string): string | null {
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].includes(sectionId)) return `line-${i}`;
	}
	if (pool.includes(sectionId)) return "pool";
	return null;
}

export const StatuslineSectionList: React.FC<StatuslineLineEditorProps> = ({
	lines,
	sectionConfig,
	onLinesChange,
	onSectionConfigChange,
}) => {
	const { t } = useI18n();
	const [activeDragId, setActiveDragId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	// Sections not in any line go into the hidden pool
	const assignedIds = new Set(lines.flat());
	const pool = ALL_SECTION_IDS.filter((id) => !assignedIds.has(id));

	const handleDragStart = (event: DragStartEvent) => {
		setActiveDragId(String(event.active.id));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		setActiveDragId(null);
		const { active, over } = event;
		if (!over) return;

		const activeId = String(active.id);
		const overId = String(over.id);

		const sourceContainer = findContainer(lines, pool, activeId);
		// over.id can be a section chip id or a container id
		let destContainer = findContainer(lines, pool, overId);
		if (!destContainer) {
			// over a container directly (empty zone droppable)
			if (overId.startsWith("line-") || overId === "pool") {
				destContainer = overId;
			}
		}

		if (!sourceContainer || !destContainer) return;
		if (activeId === overId) return;

		const newLines = lines.map((l) => [...l]);

		// Helper: get/set array for a container
		const getArr = (cid: string): string[] => {
			if (cid === "pool") return [...pool];
			const idx = Number.parseInt(cid.replace("line-", ""), 10);
			return newLines[idx] ?? [];
		};

		const setArr = (cid: string, arr: string[]) => {
			if (cid === "pool") return; // pool is derived, no direct mutation needed
			const idx = Number.parseInt(cid.replace("line-", ""), 10);
			newLines[idx] = arr;
		};

		if (sourceContainer === destContainer) {
			// Reorder within same container
			const arr = getArr(sourceContainer);
			const oldIdx = arr.indexOf(activeId);
			const newIdx = arr.indexOf(overId);
			if (oldIdx !== -1 && newIdx !== -1) {
				setArr(sourceContainer, arrayMove(arr, oldIdx, newIdx));
			}
		} else {
			// Move across containers
			const srcArr = getArr(sourceContainer);
			const dstArr = getArr(destContainer);

			const srcFiltered = srcArr.filter((id) => id !== activeId);
			const overIdx = dstArr.indexOf(overId);
			const insertAt = overIdx === -1 ? dstArr.length : overIdx;
			const dstUpdated = [...dstArr.slice(0, insertAt), activeId, ...dstArr.slice(insertAt)];

			if (sourceContainer !== "pool") setArr(sourceContainer, srcFiltered);
			if (destContainer !== "pool") setArr(destContainer, dstUpdated);
			// Moving to pool means removing from its line (srcFiltered already set)
			// Moving from pool to line: srcArr is pool (derived), no write needed
		}

		onLinesChange(newLines);
	};

	const handleAddLine = () => {
		onLinesChange([...lines, []]);
	};

	const handleRemoveLine = (lineIdx: number) => {
		const removed = lines[lineIdx] ?? [];
		// Sections in removed line go back to pool implicitly (not in any line)
		const newLines = lines.filter((_, i) => i !== lineIdx);
		// Keep sectionConfig entries — they're still valid if re-added later
		onLinesChange(newLines);
		// suppress unused-var lint: removed is used conceptually
		void removed;
	};

	const handleConfigChange = (sectionId: string, cfg: SectionConfig) => {
		onSectionConfigChange({ ...sectionConfig, [sectionId]: cfg });
	};

	return (
		<div className="space-y-3">
			<p className="text-xs text-dash-text-muted px-1">{t("statuslineDragHint")}</p>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				{/* Line zones */}
				<div className="space-y-2">
					{lines.map((lineIds, idx) => (
						<StatuslineLineZone
							key={`line-zone-${idx}`}
							containerId={`line-${idx}`}
							sectionIds={lineIds}
							sectionConfig={sectionConfig}
							onConfigChange={handleConfigChange}
							headerLabel={`${t("statuslineLine")} ${idx + 1}`}
							onRemove={() => handleRemoveLine(idx)}
						/>
					))}
				</div>

				{/* Add line button */}
				<button
					type="button"
					onClick={handleAddLine}
					className="w-full text-xs px-3 py-2 rounded-lg border border-dashed border-dash-border text-dash-text-muted hover:border-dash-accent/60 hover:text-dash-text transition-colors"
				>
					+ {t("statuslineAddLine")}
				</button>

				{/* Hidden sections pool */}
				<div className="pt-1">
					<p className="text-xs font-medium text-dash-text-muted uppercase tracking-wider mb-2 px-1">
						{t("statuslineHiddenSections")}
					</p>
					<StatuslineLineZone
						containerId="pool"
						sectionIds={pool}
						sectionConfig={sectionConfig}
						onConfigChange={handleConfigChange}
						isPool
					/>
				</div>

				{/* Drag overlay — shows ghost chip while dragging */}
				<DragOverlay>
					{activeDragId ? (
						<div className="px-2 py-1 rounded-md border border-dash-accent bg-dash-accent/20 text-xs text-dash-text shadow-xl opacity-90">
							{activeDragId}
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
};
