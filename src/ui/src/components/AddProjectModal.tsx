import type { AddProjectRequest } from "@/services/api";
import type React from "react";
import { useEffect, useState } from "react";

interface AddProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAdd: (request: AddProjectRequest) => Promise<void>;
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({ isOpen, onClose, onAdd }) => {
	const [path, setPath] = useState("");
	const [alias, setAlias] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reset form when modal opens/closes
	useEffect(() => {
		if (!isOpen) {
			setPath("");
			setAlias("");
			setError(null);
			setLoading(false);
		}
	}, [isOpen]);

	// Handle escape key
	// biome-ignore lint/correctness/useExhaustiveDependencies: onClose causes memory leak from re-runs
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen]);

	// Focus management
	useEffect(() => {
		if (!isOpen) return;

		const previousActiveElement = document.activeElement as HTMLElement;
		const firstInput = document.querySelector("#project-path") as HTMLElement;
		firstInput?.focus();

		return () => {
			previousActiveElement?.focus();
		};
	}, [isOpen]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!path.trim()) {
			setError("Path is required");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			const request: AddProjectRequest = {
				path: path.trim(),
				...(alias.trim() && { alias: alias.trim() }),
			};

			await onAdd(request);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add project");
		} finally {
			setLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={onClose}
		>
			<div
				className="bg-dash-surface border border-dash-border rounded-lg shadow-xl max-w-md w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-6 py-4 border-b border-dash-border">
					<h2 className="text-lg font-bold text-dash-text">Add Project</h2>
					<p className="text-sm text-dash-text-muted mt-1">
						Add a new ClaudeKit project to the control center
					</p>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-6 space-y-4">
					{/* Path input */}
					<div>
						<label htmlFor="project-path" className="block text-sm font-medium text-dash-text mb-2">
							Project Path <span className="text-red-500">*</span>
						</label>
						<input
							id="project-path"
							type="text"
							value={path}
							onChange={(e) => setPath(e.target.value)}
							placeholder="/path/to/project"
							disabled={loading}
							className="w-full px-3 py-2 bg-dash-bg border border-dash-border rounded-md text-dash-text placeholder-dash-text-muted focus:outline-none focus:ring-2 focus:ring-dash-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						/>
					</div>

					{/* Alias input */}
					<div>
						<label
							htmlFor="project-alias"
							className="block text-sm font-medium text-dash-text mb-2"
						>
							Alias (optional)
						</label>
						<input
							id="project-alias"
							type="text"
							value={alias}
							onChange={(e) => setAlias(e.target.value)}
							placeholder="my-project"
							disabled={loading}
							className="w-full px-3 py-2 bg-dash-bg border border-dash-border rounded-md text-dash-text placeholder-dash-text-muted focus:outline-none focus:ring-2 focus:ring-dash-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						/>
						<p className="text-xs text-dash-text-muted mt-1">Custom display name for the project</p>
					</div>

					{/* Error message */}
					{error && (
						<div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md">
							<p className="text-sm text-red-500">{error}</p>
						</div>
					)}

					{/* Buttons */}
					<div className="flex gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							disabled={loading}
							className="flex-1 px-4 py-2 border border-dash-border rounded-md text-dash-text-secondary hover:bg-dash-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading || !path.trim()}
							className="flex-1 px-4 py-2 bg-dash-accent text-white rounded-md hover:bg-dash-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading ? "Adding..." : "Add Project"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AddProjectModal;
