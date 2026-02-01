/**
 * Draggable resize handle for panels
 * Shows visual feedback on hover and drag
 */
import type React from "react";

interface ResizeHandleProps {
	/** Direction: vertical line for horizontal resize, horizontal line for vertical */
	direction?: "horizontal" | "vertical";
	/** Whether currently dragging */
	isDragging?: boolean;
	/** Mouse down handler from useResizable */
	onMouseDown: (e: React.MouseEvent) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
	direction = "horizontal",
	isDragging = false,
	onMouseDown,
}) => {
	const isHorizontal = direction === "horizontal";

	return (
		<div
			onMouseDown={onMouseDown}
			className={`
				group flex items-center justify-center shrink-0
				${isHorizontal ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize"}
				${isDragging ? "bg-dash-accent/20" : "hover:bg-dash-surface-hover/50"}
				transition-colors
			`}
		>
			<div
				className={`
					rounded-full transition-all
					${isHorizontal ? "w-0.5 h-8" : "h-0.5 w-8"}
					${isDragging ? "bg-dash-accent" : "bg-dash-border group-hover:bg-dash-text-muted"}
				`}
			/>
		</div>
	);
};

export default ResizeHandle;
