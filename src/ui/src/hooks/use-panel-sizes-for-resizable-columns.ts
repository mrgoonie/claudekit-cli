/**
 * Hook for creating resizable panel groups (2 or 3 panels)
 * Maintains proportional sizes and persists to localStorage
 */
import { useCallback, useEffect, useState } from "react";

interface UsePanelSizesOptions {
	/** localStorage key for persistence */
	storageKey: string;
	/** Default sizes as percentages (must sum to 100) */
	defaultSizes: number[];
	/** Minimum size in percentage for each panel */
	minSizes: number[];
}

interface UsePanelSizesReturn {
	/** Current sizes as percentages */
	sizes: number[];
	/** Whether currently dragging */
	isDragging: boolean;
	/** Start drag handler for a specific divider (0 = between panel 0 and 1) */
	startDrag: (dividerIndex: number, e: React.MouseEvent) => void;
	/** Reset to default sizes */
	reset: () => void;
}

export function usePanelSizes({
	storageKey,
	defaultSizes,
	minSizes,
}: UsePanelSizesOptions): UsePanelSizesReturn {
	const [sizes, setSizes] = useState<number[]>(() => {
		if (typeof window === "undefined") return defaultSizes;
		const saved = localStorage.getItem(storageKey);
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as number[];
				if (Array.isArray(parsed) && parsed.length === defaultSizes.length) {
					const sum = parsed.reduce((a, b) => a + b, 0);
					if (Math.abs(sum - 100) < 1) return parsed;
				}
			} catch {
				// ignore
			}
		}
		return defaultSizes;
	});

	const [isDragging, setIsDragging] = useState(false);

	// Persist to localStorage
	useEffect(() => {
		localStorage.setItem(storageKey, JSON.stringify(sizes));
	}, [sizes, storageKey]);

	const startDrag = useCallback(
		(dividerIndex: number, e: React.MouseEvent) => {
			e.preventDefault();
			setIsDragging(true);

			const container = (e.target as HTMLElement).parentElement;
			if (!container) return;

			const containerRect = container.getBoundingClientRect();
			const containerWidth = containerRect.width;
			const startX = e.clientX;
			const startSizes = [...sizes];

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = moveEvent.clientX - startX;
				const deltaPercent = (deltaX / containerWidth) * 100;

				const newSizes = [...startSizes];
				// Adjust the two panels adjacent to this divider
				const leftIndex = dividerIndex;
				const rightIndex = dividerIndex + 1;

				let leftNew = startSizes[leftIndex] + deltaPercent;
				let rightNew = startSizes[rightIndex] - deltaPercent;

				// Enforce minimum sizes
				if (leftNew < minSizes[leftIndex]) {
					leftNew = minSizes[leftIndex];
					rightNew = startSizes[leftIndex] + startSizes[rightIndex] - leftNew;
				}
				if (rightNew < minSizes[rightIndex]) {
					rightNew = minSizes[rightIndex];
					leftNew = startSizes[leftIndex] + startSizes[rightIndex] - rightNew;
				}

				newSizes[leftIndex] = leftNew;
				newSizes[rightIndex] = rightNew;
				setSizes(newSizes);
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
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
		},
		[sizes, minSizes],
	);

	const reset = useCallback(() => {
		setSizes(defaultSizes);
	}, [defaultSizes]);

	return { sizes, isDragging, startDrag, reset };
}
