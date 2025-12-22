import { useState, useEffect } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { useProjects } from "./hooks/useProjects";
import { ProjectItem, type HealthStatus } from "./ProjectItem";
import { AddProjectDialog } from "./AddProjectDialog";
import { useToast } from "../../hooks/useToast";
import type { Project } from "../../api/projects";

const STORAGE_KEY = "claudekit-current-project";

interface ProjectListProps {
	onProjectChange?: (project: Project | null) => void;
}

export function ProjectList({ onProjectChange }: ProjectListProps) {
	const { projects, loading, error, add, remove, reload } = useProjects();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			return saved ? JSON.parse(saved) : null;
		} catch {
			return null;
		}
	});
	const { toast } = useToast();

	// Persist current project selection
	useEffect(() => {
		if (currentProjectId) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProjectId));
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	}, [currentProjectId]);

	// Notify parent of project changes
	useEffect(() => {
		const currentProject = projects.find((p) => p.id === currentProjectId) ?? null;
		onProjectChange?.(currentProject);
	}, [currentProjectId, projects, onProjectChange]);

	const handleSelect = (project: Project) => {
		setCurrentProjectId(project.id);
	};

	const handleAdd = async (path: string, name?: string) => {
		try {
			const project = await add(path, name);
			setCurrentProjectId(project.id);
			toast({ title: "Project added", variant: "success" });
		} catch (e) {
			toast({
				title: "Failed to add project",
				description: (e as Error).message,
				variant: "destructive",
			});
			throw e;
		}
	};

	const handleRemove = async (id: string) => {
		if (!confirm("Remove this project from the list?")) return;
		try {
			await remove(id);
			if (currentProjectId === id) {
				setCurrentProjectId(null);
			}
			toast({ title: "Project removed", variant: "success" });
		} catch (e) {
			toast({
				title: "Failed to remove project",
				description: (e as Error).message,
				variant: "destructive",
			});
		}
	};

	// Placeholder health status - can be enhanced later with real health checks
	const getHealthStatus = (_project: Project): HealthStatus => {
		return "healthy";
	};

	if (loading) {
		return (
			<div className="px-3 py-2 text-sm text-gray-500">Loading projects...</div>
		);
	}

	if (error) {
		return (
			<div className="px-3 py-2 space-y-2">
				<div className="text-sm text-red-500">{error}</div>
				<button
					type="button"
					onClick={reload}
					className="text-sm text-blue-600 hover:underline"
				>
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{projects.length === 0 ? (
				<div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
					<FolderKanban className="h-4 w-4" />
					No projects yet
				</div>
			) : (
				projects.map((p) => (
					<ProjectItem
						key={p.id}
						project={p}
						isSelected={p.id === currentProjectId}
						healthStatus={getHealthStatus(p)}
						onSelect={() => handleSelect(p)}
						onRemove={() => handleRemove(p.id)}
					/>
				))
			)}

			<button
				type="button"
				className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 w-full hover:bg-gray-50 rounded transition-colors"
				onClick={() => setDialogOpen(true)}
			>
				<Plus className="h-4 w-4" />
				Add Project
			</button>

			<AddProjectDialog
				isOpen={dialogOpen}
				onClose={() => setDialogOpen(false)}
				onAdd={handleAdd}
			/>
		</div>
	);
}
