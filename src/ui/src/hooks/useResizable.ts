/**
 * Hook for creating resizable panels with mouse drag
 * Persists sizes to localStorage and supports min/max constraints
 */
import { useCallback, useEffect, useState } from "react";

interface UseResizableOptions {
	/** localStorage key for persistence */
	storageKey: string;
	/** Default size in pixels */
	defaultSize: number;
	/** Minimum allowed size */
	minSize: number;
	/** Maximum allowed size */
	maxSize: number;
	/** Direction of resize: horizontal (left-right) or vertical (up-down) */
	direction?: "horizontal" | "vertical";
}

interface UseResizableReturn {
	/** Current size in pixels */
	size: number;
	/** Whether currently dragging */
	isDragging: boolean;
	/** Start drag handler - attach to resize handle onMouseDown */
	startDrag: (e: React.MouseEvent) => void;
	/** Reset to default size */
	reset: () => void;
}

export function useResizable({
	storageKey,
	defaultSize,
	minSize,
	maxSize,
	direction = "horizontal",
}: UseResizableOptions): UseResizableReturn {
	const [size, setSize] = useState<number>(() => {
		if (typeof window === "undefined") return defaultSize;
		const saved = localStorage.getItem(storageKey);
		if (saved) {
			const parsed = Number.parseInt(saved, 10);
			if (!Number.isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
				return parsed;
			}
		}
		return defaultSize;
	});

	const [isDragging, setIsDragging] = useState(false);

	// Persist to localStorage when size changes
	useEffect(() => {
		localStorage.setItem(storageKey, String(size));
	}, [size, storageKey]);

	const startDrag = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setIsDragging(true);

			const startPos = direction === "horizontal" ? e.clientX : e.clientY;
			const startSize = size;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const currentPos = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
				const delta = currentPos - startPos;
				const newSize = Math.max(minSize, Math.min(maxSize, startSize + delta));
				setSize(newSize);
			};

			const handleMouseUp = () => {
				setIsDragging(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
			document.body.style.userSelect = "none";
		},
		[size, minSize, maxSize, direction],
	);

	const reset = useCallback(() => {
		setSize(defaultSize);
	}, [defaultSize]);

	return { size, isDragging, startDrag, reset };
}
