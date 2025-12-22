import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useSuggestions } from "./hooks/useProjects";

interface AddProjectDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onAdd: (path: string, name?: string) => Promise<void>;
}

export function AddProjectDialog({ isOpen, onClose, onAdd }: AddProjectDialogProps) {
	const [path, setPath] = useState("");
	const [name, setName] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const { suggestions, load, loading } = useSuggestions();

	useEffect(() => {
		if (isOpen) {
			load();
		}
	}, [isOpen, load]);

	const handleSubmit = async () => {
		if (!path.trim()) return;
		setSubmitting(true);
		try {
			await onAdd(path.trim(), name.trim() || undefined);
			setPath("");
			setName("");
			onClose();
		} finally {
			setSubmitting(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			onClose();
		} else if (e.key === "Enter" && path.trim()) {
			handleSubmit();
		}
	};

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
			onClick={(e) => e.target === e.currentTarget && onClose()}
			onKeyDown={handleKeyDown}
		>
			<div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto shadow-xl">
				<h2 className="text-lg font-semibold mb-4">Add Project</h2>

				<div className="space-y-4">
					<div>
						<label htmlFor="project-path" className="block text-sm font-medium mb-1">
							Path
						</label>
						<Input
							id="project-path"
							value={path}
							onChange={(e) => setPath(e.target.value)}
							placeholder="/path/to/project"
							autoFocus
						/>
					</div>

					<div>
						<label htmlFor="project-name" className="block text-sm font-medium mb-1">
							Name (optional)
						</label>
						<Input
							id="project-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="My Project"
						/>
					</div>

					{loading && (
						<div className="text-sm text-gray-500">Loading suggestions...</div>
					)}

					{suggestions.length > 0 && (
						<div>
							<label className="block text-sm font-medium text-gray-500 mb-1">
								Suggestions
							</label>
							<div className="max-h-40 overflow-y-auto border rounded">
								{suggestions.map((s) => (
									<button
										type="button"
										key={s.path}
										className="w-full px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm text-left"
										onClick={() => {
											setPath(s.path);
											setName(s.name);
										}}
									>
										<div className="font-medium">{s.name}</div>
										<div className="text-gray-500 text-xs truncate">{s.path}</div>
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2 mt-6">
					<Button variant="outline" onClick={onClose} disabled={submitting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!path.trim() || submitting}>
						{submitting ? "Adding..." : "Add"}
					</Button>
				</div>
			</div>
		</div>
	);
}
