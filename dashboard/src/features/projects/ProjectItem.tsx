import { Trash2, Circle } from "lucide-react";
import type { Project } from "../../api/projects";

export type HealthStatus = "healthy" | "warning" | "error";

interface ProjectItemProps {
	project: Project;
	isSelected: boolean;
	healthStatus?: HealthStatus;
	onSelect: () => void;
	onRemove: () => void;
}

const statusColors: Record<HealthStatus, string> = {
	healthy: "text-green-500",
	warning: "text-yellow-500",
	error: "text-red-500",
};

export function ProjectItem({
	project,
	isSelected,
	healthStatus = "healthy",
	onSelect,
	onRemove,
}: ProjectItemProps) {
	return (
		<div
			className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer group ${
				isSelected ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100"
			}`}
			onClick={onSelect}
		>
			<Circle className={`h-2 w-2 fill-current ${statusColors[healthStatus]}`} />
			<span className="flex-1 truncate text-sm" title={project.path}>
				{project.name}
			</span>
			<button
				type="button"
				className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
				onClick={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				aria-label={`Remove ${project.name}`}
			>
				<Trash2 className="h-3 w-3" />
			</button>
		</div>
	);
}
