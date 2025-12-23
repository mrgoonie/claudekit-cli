import type React from "react";
import { HealthStatus, type Project } from "../types";

interface SidebarProps {
	projects: Project[];
	currentProjectId: string | null;
	isCollapsed: boolean;
	onSwitchProject: (id: string) => void;
	onToggle: () => void;
	activeView: string;
	onSetView: (view: any) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
	projects,
	currentProjectId,
	isCollapsed,
	onSwitchProject,
	onToggle,
	activeView,
	onSetView,
}) => {
	return (
		<aside
			className={`${
				isCollapsed ? "w-20" : "w-72"
			} bg-dash-surface border-r border-dash-border flex flex-col transition-all duration-300 ease-in-out z-20 h-full`}
		>
			{/* Branding */}
			<div className="p-6 flex items-center gap-3">
				<div className="w-8 h-8 rounded-lg bg-dash-accent flex items-center justify-center shrink-0 shadow-[0_0_15px_var(--dash-accent-glow)]">
					<span className="text-dash-bg font-bold text-xs">CK</span>
				</div>
				{!isCollapsed && (
					<div className="overflow-hidden">
						<h1 className="text-sm font-bold truncate tracking-tight text-dash-text">ClaudeKit</h1>
						<p className="text-[10px] text-dash-text-muted font-medium uppercase tracking-wider">
							Control Center
						</p>
					</div>
				)}
			</div>

			{/* Projects List */}
			<div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
				{!isCollapsed && (
					<p className="px-2 pb-2 text-[10px] font-bold text-dash-text-muted uppercase tracking-widest">
						Projects
					</p>
				)}
				{projects.map((project) => (
					<button
						key={project.id}
						onClick={() => onSwitchProject(project.id)}
						className={`w-full group relative flex items-center gap-3 p-2.5 rounded-md transition-colors ${
							currentProjectId === project.id
								? "bg-dash-accent-subtle text-dash-accent border border-dash-accent/10"
								: "text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text border border-transparent"
						}`}
					>
						<div
							className={`w-2 h-2 rounded-full shrink-0 ${
								project.health === HealthStatus.HEALTHY
									? "bg-dash-accent"
									: project.health === HealthStatus.WARNING
										? "bg-orange-400"
										: "bg-red-500"
							} ${currentProjectId === project.id ? "animate-pulse" : ""}`}
						/>
						{!isCollapsed && <span className="text-sm font-medium truncate">{project.name}</span>}
						{isCollapsed && (
							<div className="absolute left-16 px-2 py-1 bg-dash-text text-dash-bg text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-dash-border">
								{project.name}
							</div>
						)}
					</button>
				))}

				<button className="w-full flex items-center gap-3 p-2.5 rounded-md text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text-secondary transition-colors mt-4">
					<div className="w-5 h-5 flex items-center justify-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 4v16m8-8H4"
							/>
						</svg>
					</div>
					{!isCollapsed && <span className="text-sm font-medium">Add Project</span>}
				</button>
			</div>

			{/* Global Section */}
			<div className="px-4 py-4 border-t border-dash-border space-y-1">
				{!isCollapsed && (
					<p className="px-2 pb-2 text-[10px] font-bold text-dash-text-muted uppercase tracking-widest">
						Global
					</p>
				)}

				<SidebarItem
					icon="⚡"
					label="Skills"
					badge="12"
					isCollapsed={isCollapsed}
					active={activeView === "skills"}
					onClick={() => onSetView("skills")}
				/>
				<SidebarItem
					icon="🛡️"
					label="Health"
					badge="3"
					badgeColor="bg-dash-accent-subtle text-dash-accent"
					isCollapsed={isCollapsed}
					active={activeView === "health"}
					onClick={() => onSetView("health")}
				/>

				<button
					onClick={onToggle}
					className="w-full flex items-center gap-3 p-2 rounded-md text-dash-text-muted hover:bg-dash-surface-hover transition-colors mt-6"
				>
					<div className="w-5 h-5 flex items-center justify-center">
						{isCollapsed ? (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M13 5l7 7-7 7M5 5l7 7-7 7"
								/>
							</svg>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
								/>
							</svg>
						)}
					</div>
					{!isCollapsed && <span className="text-sm font-medium">Collapse</span>}
				</button>
			</div>
		</aside>
	);
};

interface SidebarItemProps {
	icon: string;
	label: string;
	badge?: string;
	badgeColor?: string;
	isCollapsed: boolean;
	active?: boolean;
	onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
	icon,
	label,
	badge,
	badgeColor = "bg-dash-accent-subtle text-dash-accent",
	isCollapsed,
	active,
	onClick,
}) => (
	<button
		onClick={onClick}
		className={`w-full group relative flex items-center gap-3 p-2 rounded-md transition-colors ${
			active
				? "bg-dash-surface-hover text-dash-text"
				: "text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
		}`}
	>
		<div className="w-5 h-5 flex items-center justify-center">{icon}</div>
		{!isCollapsed && (
			<>
				<span className="text-sm font-medium flex-1 text-left">{label}</span>
				{badge && (
					<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>
						{badge}
					</span>
				)}
			</>
		)}
		{isCollapsed && (
			<div className="absolute left-16 px-2 py-1 bg-dash-text text-dash-bg text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-dash-border">
				{label}
			</div>
		)}
	</button>
);

export default Sidebar;
