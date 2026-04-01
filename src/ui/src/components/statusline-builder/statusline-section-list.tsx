import { SECTION_DESCRIPTIONS, SECTION_LABELS } from "@/types/statusline-types";
import type { StatuslineSection } from "@/types/statusline-types";
/**
 * Sortable list of statusline sections using @dnd-kit.
 * Wraps DndContext + SortableContext for drag-and-drop reordering.
 */
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type React from "react";
import { useI18n } from "../../i18n";
import { StatuslineSectionCard } from "./statusline-section-card";

interface StatuslineSectionListProps {
	sections: StatuslineSection[];
	onChange: (sections: StatuslineSection[]) => void;
}

export const StatuslineSectionList: React.FC<StatuslineSectionListProps> = ({
	sections,
	onChange,
}) => {
	const { t } = useI18n();

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = sections.findIndex((s) => s.id === active.id);
		const newIndex = sections.findIndex((s) => s.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const reordered = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({
			...s,
			order: i,
		}));
		onChange(reordered);
	};

	const handleToggle = (id: string, enabled: boolean) => {
		onChange(sections.map((s) => (s.id === id ? { ...s, enabled } : s)));
	};

	const handleUpdate = (updated: StatuslineSection) => {
		onChange(sections.map((s) => (s.id === updated.id ? updated : s)));
	};

	const sectionIds = sections.map((s) => s.id);

	return (
		<div className="space-y-2">
			<p className="text-xs text-dash-text-muted px-1">{t("statuslineDragHint")}</p>
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
				<SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
					<div className="space-y-2">
						{sections.map((section) => (
							<StatuslineSectionCard
								key={section.id}
								section={section}
								label={SECTION_LABELS[section.id]}
								description={SECTION_DESCRIPTIONS[section.id]}
								onUpdate={handleUpdate}
								onToggle={handleToggle}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
};
