import {
	AlertTriangle,
	ChevronLeft,
	ChevronRight,
	FolderKanban,
	Plus,
	Zap,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useProject } from "../contexts/ProjectContext";

interface SidebarProps {
	collapsed: boolean;
	onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
	const { projects, currentProject, setCurrentProject, isLoading } =
		useProject();

	return (
		<aside
			className={cn(
				"flex flex-col h-full bg-white border-r transition-all duration-200",
				collapsed ? "w-16" : "w-64",
			)}
		>
			{/* Logo/Title */}
			<div className="flex items-center gap-2 px-4 py-4 border-b">
				<FolderKanban className="h-6 w-6 text-primary shrink-0" />
				{!collapsed && (
					<span className="font-semibold text-gray-900 truncate">
						ClaudeKit
					</span>
				)}
			</div>

			{/* Project List */}
			<div className="flex-1 overflow-y-auto py-2">
				{!collapsed && (
					<div className="px-3 mb-2">
						<span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
							Projects
						</span>
					</div>
				)}

				{isLoading ? (
					<div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
				) : (
					<nav className="space-y-1 px-2">
						{projects.map((project) => (
							<button
								key={project.id}
								onClick={() => setCurrentProject(project)}
								className={cn(
									"w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors",
									currentProject?.id === project.id
										? "bg-primary/10 text-primary"
										: "text-gray-700 hover:bg-gray-100",
								)}
								title={collapsed ? project.name : undefined}
							>
								<FolderKanban className="h-4 w-4 shrink-0" />
								{!collapsed && (
									<span className="truncate text-sm">{project.name}</span>
								)}
							</button>
						))}
					</nav>
				)}

				{/* Add Project Button */}
				<div className="px-2 mt-2">
					<Button
						variant="ghost"
						size={collapsed ? "icon" : "sm"}
						className={cn("w-full", !collapsed && "justify-start")}
						title={collapsed ? "Add Project" : undefined}
					>
						<Plus className="h-4 w-4" />
						{!collapsed && <span className="ml-2">Add Project</span>}
					</Button>
				</div>
			</div>

			{/* Divider + Health/Skills */}
			<div className="border-t py-2 px-2 space-y-1">
				<button
					className={cn(
						"w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-gray-700 hover:bg-gray-100 transition-colors",
					)}
					title={collapsed ? "Health" : undefined}
				>
					<AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
					{!collapsed && (
						<>
							<span className="text-sm">Health</span>
							<span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
								3 issues
							</span>
						</>
					)}
				</button>

				<button
					className={cn(
						"w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-gray-700 hover:bg-gray-100 transition-colors",
					)}
					title={collapsed ? "Skills" : undefined}
				>
					<Zap className="h-4 w-4 shrink-0 text-blue-500" />
					{!collapsed && (
						<>
							<span className="text-sm">Skills</span>
							<span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
								12 available
							</span>
						</>
					)}
				</button>
			</div>

			{/* Collapse Toggle */}
			<div className="border-t p-2">
				<Button
					variant="ghost"
					size="icon"
					onClick={onToggle}
					className="w-full"
					title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{collapsed ? (
						<ChevronRight className="h-4 w-4" />
					) : (
						<ChevronLeft className="h-4 w-4" />
					)}
				</Button>
			</div>
		</aside>
	);
}
