/**
 * UpdateProgressModal - Real-time update progress display via SSE
 * Connects to /api/system/update stream, shows phases by default with collapsible full output
 */
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";

interface UpdateProgressModalProps {
	isOpen: boolean;
	onClose: () => void;
	target: "cli" | "kit";
	kitName?: string;
	targetVersion?: string;
	onComplete: () => void;
}

type UpdateStatus = "running" | "success" | "error";

interface SSEMessage {
	type: "start" | "phase" | "output" | "error" | "complete";
	name?: string; // for phase
	text?: string; // for output
	stream?: string; // for output (stdout/stderr)
	message?: string; // for start/error
	code?: number; // for complete/error
}

const UpdateProgressModal: React.FC<UpdateProgressModalProps> = ({
	isOpen,
	onClose,
	target,
	kitName,
	targetVersion,
	onComplete,
}) => {
	const { t } = useI18n();
	const [status, setStatus] = useState<UpdateStatus>("running");
	const [phases, setPhases] = useState<string[]>([]);
	const [fullOutput, setFullOutput] = useState<string[]>([]);
	const [showDetails, setShowDetails] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);
	const outputEndRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new output arrives
	useEffect(() => {
		if (showDetails && outputEndRef.current) {
			outputEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [showDetails]);

	// Connect to SSE stream when modal opens
	useEffect(() => {
		if (!isOpen) return;

		const params = new URLSearchParams({ target });
		if (kitName) params.set("kit", kitName);
		if (targetVersion) params.set("version", targetVersion);

		const eventSource = new EventSource(`/api/system/update?${params}`);
		eventSourceRef.current = eventSource;

		eventSource.onmessage = (event) => {
			try {
				const data: SSEMessage = JSON.parse(event.data);

				// Handle by message type
				if (data.type === "phase" && data.name) {
					setPhases((prev) => [...prev, data.name as string]);
				}
				if (data.type === "output" && data.text) {
					setFullOutput((prev) => [...prev, data.text as string]);
				}
				if (data.type === "error") {
					setStatus("error");
					setFullOutput((prev) => [
						...prev,
						`[ERROR] ${data.message || "Unknown error"}`,
					]);
				}
				if (data.type === "complete") {
					setStatus(data.code === 0 ? "success" : "error");
					eventSource.close();
					if (data.code === 0) {
						onComplete();
					}
				}
			} catch (err) {
				console.error("Failed to parse SSE message:", err);
			}
		};

		eventSource.onerror = () => {
			setStatus("error");
			setFullOutput((prev) => [...prev, "[ERROR] Connection lost"]);
			eventSource.close();
		};

		return () => {
			eventSource.close();
		};
	}, [isOpen, target, kitName, targetVersion, onComplete]);

	// Reset state when closing
	const handleClose = () => {
		if (status === "running") return; // Block close while running
		setStatus("running");
		setPhases([]);
		setFullOutput([]);
		setShowDetails(false);
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-dash-surface border border-dash-border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
				{/* Header */}
				<div className="px-6 py-4 border-b border-dash-border">
					<h2 className="text-lg font-bold text-dash-text">
						{status === "running"
							? t("updating")
							: status === "success"
								? t("updateSuccess")
								: t("updateFailed")}
					</h2>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-4">
					{/* Phase indicators (always visible) */}
					{phases.length > 0 && (
						<div className="space-y-2">
							{phases.map((phase, idx) => (
								<div
									key={`${phase}-${idx}`}
									className="flex items-center gap-2 text-sm text-dash-text-secondary"
								>
									<span className="w-1.5 h-1.5 rounded-full bg-dash-accent" />
									<span>{phase}</span>
								</div>
							))}
						</div>
					)}

					{/* Running spinner */}
					{status === "running" && (
						<div className="flex items-center gap-2 text-sm text-dash-text-muted">
							<span className="w-4 h-4 border-2 border-dash-text-muted border-t-transparent rounded-full animate-spin" />
							<span>{t("updating")}</span>
						</div>
					)}

					{/* Collapsible full output */}
					{fullOutput.length > 0 && (
						<div>
							<button
								type="button"
								onClick={() => setShowDetails(!showDetails)}
								className="text-xs text-dash-accent hover:text-dash-accent-hover transition-colors"
							>
								{showDetails ? t("hideDetails") : t("showDetails")}
							</button>
							{showDetails && (
								<div className="mt-2 bg-dash-bg border border-dash-border rounded p-3 max-h-64 overflow-y-auto">
									<pre className="text-xs mono text-dash-text whitespace-pre-wrap">
										{fullOutput.join("\n")}
									</pre>
									<div ref={outputEndRef} />
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-dash-border flex justify-end">
					<button
						type="button"
						onClick={handleClose}
						disabled={status === "running"}
						className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
							status === "running"
								? "bg-dash-bg text-dash-text-muted cursor-not-allowed"
								: "bg-dash-accent text-white hover:bg-dash-accent-hover"
						}`}
					>
						{t("closeModal")}
					</button>
				</div>
			</div>
		</div>
	);
};

export default UpdateProgressModal;
