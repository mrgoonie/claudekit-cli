import type { Project } from "@/types";

interface SidebarProps {
	projects: Project[];
	currentProjectId: string;
	isCollapsed: boolean;
	onSwitchProject: (id: string) => void;
	onToggle: () => void;
	activeView: "dashboard" | "config";
	onSetView: (view: "dashboard" | "config") => void;
}

export default function Sidebar({
	projects,
	currentProjectId,
	isCollapsed,
	onSwitchProject,
	onToggle,
	activeView,
	onSetView,
}: SidebarProps) {
	return (
		<aside
			className={`h-full border-r border-dash-border bg-dash-surface transition-all duration-200 ${
				isCollapsed ? "w-16" : "w-64"
			}`}
		>
			<div className="flex flex-col h-full">
				{/* Logo/Toggle */}
				<div className="h-14 flex items-center justify-between px-4 border-b border-dash-border">
					{!isCollapsed && <span className="text-sm font-semibold text-dash-accent">CK</span>}
					<button
						type="button"
						onClick={onToggle}
						className="p-2 rounded hover:bg-dash-surface-hover transition-colors"
						aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						{isCollapsed ? "→" : "←"}
					</button>
				</div>

				{/* Navigation */}
				<nav className="flex-1 py-4">
					<div className="px-3 mb-4">
						{!isCollapsed && (
							<span className="text-xs uppercase text-dash-text-muted font-medium">Views</span>
						)}
						<div className="mt-2 space-y-1">
							<button
								type="button"
								onClick={() => onSetView("dashboard")}
								className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
									activeView === "dashboard"
										? "bg-dash-accent text-white"
										: "text-dash-text-secondary hover:bg-dash-surface-hover"
								}`}
							>
								📊{!isCollapsed && <span>Dashboard</span>}
							</button>
							<button
								type="button"
								onClick={() => onSetView("config")}
								className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
									activeView === "config"
										? "bg-dash-accent text-white"
										: "text-dash-text-secondary hover:bg-dash-surface-hover"
								}`}
							>
								⚙️
								{!isCollapsed && <span>Configuration</span>}
							</button>
						</div>
					</div>

					{/* Projects */}
					<div className="px-3">
						{!isCollapsed && (
							<span className="text-xs uppercase text-dash-text-muted font-medium">Projects</span>
						)}
						<div className="mt-2 space-y-1">
							{projects.map((project) => (
								<button
									type="button"
									key={project.id}
									onClick={() => onSwitchProject(project.id)}
									className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
										currentProjectId === project.id
											? "bg-dash-surface-hover text-dash-text"
											: "text-dash-text-secondary hover:bg-dash-surface-hover"
									}`}
									title={project.path}
								>
									{project.id === "global" ? "🌐" : "📁"}
									{!isCollapsed && <span className="truncate">{project.name}</span>}
								</button>
							))}
						</div>
					</div>
				</nav>

				{/* Footer */}
				{!isCollapsed && (
					<div className="p-4 border-t border-dash-border">
						<p className="text-xs text-dash-text-muted text-center">ClaudeKit Dashboard</p>
					</div>
				)}
			</div>
		</aside>
	);
}
