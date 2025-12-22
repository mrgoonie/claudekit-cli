import { useToast } from "../../hooks/useToast";
import { Toast } from "./toast";

export function Toaster() {
	const { toasts, dismiss } = useToast();

	if (toasts.length === 0) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
			{toasts.map((toast) => (
				<Toast key={toast.id} toast={toast} onDismiss={dismiss} />
			))}
		</div>
	);
}
