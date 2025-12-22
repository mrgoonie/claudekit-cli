import { useCallback, useState } from "react";

export type ToastVariant = "default" | "success" | "destructive";

export interface Toast {
	id: string;
	title: string;
	description?: string;
	variant?: ToastVariant;
}

interface ToastOptions {
	title: string;
	description?: string;
	variant?: ToastVariant;
	duration?: number;
}

// Global state for toasts - allows useToast to be called from anywhere
let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toastState: Toast[] = [];

function notifyListeners() {
	for (const listener of toastListeners) {
		listener([...toastState]);
	}
}

function addToast(options: ToastOptions) {
	const id = crypto.randomUUID();
	const toast: Toast = {
		id,
		title: options.title,
		description: options.description,
		variant: options.variant ?? "default",
	};

	toastState = [...toastState, toast];
	notifyListeners();

	// Auto-dismiss after duration (default 4s)
	const duration = options.duration ?? 4000;
	setTimeout(() => {
		removeToast(id);
	}, duration);

	return id;
}

function removeToast(id: string) {
	toastState = toastState.filter((t) => t.id !== id);
	notifyListeners();
}

export function useToast() {
	const [toasts, setToasts] = useState<Toast[]>(toastState);

	// Subscribe to toast state changes
	useState(() => {
		const listener = (newToasts: Toast[]) => setToasts(newToasts);
		toastListeners.push(listener);
		return () => {
			toastListeners = toastListeners.filter((l) => l !== listener);
		};
	});

	const toast = useCallback((options: ToastOptions) => {
		return addToast(options);
	}, []);

	const dismiss = useCallback((id: string) => {
		removeToast(id);
	}, []);

	return { toasts, toast, dismiss };
}

// Standalone toast function for use outside React components
export const toast = (options: ToastOptions) => addToast(options);
