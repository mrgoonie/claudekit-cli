import { cn } from "../../lib/utils";
import type { Toast as ToastType, ToastVariant } from "../../hooks/useToast";

interface ToastProps {
	toast: ToastType;
	onDismiss: (id: string) => void;
}

const variantStyles: Record<ToastVariant, string> = {
	default: "bg-white border-gray-200 text-gray-900",
	success: "bg-green-50 border-green-200 text-green-900",
	destructive: "bg-red-50 border-red-200 text-red-900",
};

const iconMap: Record<ToastVariant, string> = {
	default: "i",
	success: "\u2713",
	destructive: "\u2717",
};

export function Toast({ toast, onDismiss }: ToastProps) {
	const variant = toast.variant ?? "default";

	return (
		<div
			className={cn(
				"pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg",
				"animate-in slide-in-from-right-full duration-300",
				variantStyles[variant],
			)}
			role="alert"
		>
			<span
				className={cn(
					"flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
					variant === "success" && "bg-green-500 text-white",
					variant === "destructive" && "bg-red-500 text-white",
					variant === "default" && "bg-gray-500 text-white",
				)}
			>
				{iconMap[variant]}
			</span>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium">{toast.title}</p>
				{toast.description && (
					<p className="text-sm opacity-80 mt-0.5">{toast.description}</p>
				)}
			</div>
			<button
				type="button"
				onClick={() => onDismiss(toast.id)}
				className="shrink-0 rounded p-1 opacity-50 hover:opacity-100 transition-opacity"
				aria-label="Dismiss"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	);
}
