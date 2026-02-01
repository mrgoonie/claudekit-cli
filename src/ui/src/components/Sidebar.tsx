/**
 * App sidebar with project list and navigation
 */
import type { AddProjectRequest } from "@/services/api";
import type React from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { HealthStatus, type Project } from "../types";
import AddProjectModal from "./AddProjectModal";
import LanguageSwitcher from "./LanguageSwitcher";

interface SidebarProps {
	projects: Project[];
	currentProjectId: string | null;
	isCollapsed: boolean;
	/** Custom width in pixels - when set, overrides isCollapsed width */
	width?: number;
	/** Connection status for SYNC indicator */
	isConnected: boolean;
	/** Current theme */
	theme: "light" | "dark";
	onSwitchProject: (id: string) => void;
	onToggle: () => void;
	onAddProject: (request: AddProjectRequest) => Promise<void>;
	onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
	projects,
	currentProjectId,
	isCollapsed,
	width,
	isConnected,
	theme,
	onSwitchProject,
	onToggle,
	onAddProject,
	onToggleTheme,
}) => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);

	// Determine active view from URL path
	const isGlobalConfigView = location.pathname === "/config/global";
	const isSkillsView = location.pathname === "/skills";

	// Filter out global installation (~/.claude), then sort: pinned first, then by name
	const sortedProjects = [...projects]
		.filter((p) => !p.path.endsWith("/.claude") && p.path !== "~/.claude")
		.sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return a.name.localeCompare(b.name);
		});

	// Use custom width if provided, otherwise use collapsed/expanded classes
	const widthStyle = width ? { width: `${width}px` } : undefined;
	const widthClass = width ? "" : isCollapsed ? "w-14" : "w-72";
	// Hide text when sidebar is narrow (either collapsed or resized small)
	const showText = width ? width >= 160 : !isCollapsed;

	return (
		<aside
			style={widthStyle}
			className={`${widthClass} bg-dash-surface border-r border-dash-border flex flex-col transition-all duration-300 ease-in-out z-20 h-full overflow-hidden`}
		>
			{/* Branding */}
			<div className={`flex items-center ${showText ? "p-6 gap-3" : "p-2 justify-center"}`}>
				<img src="/images/logo-transparent-32.png" alt="ClaudeKit" className="w-8 h-8 shrink-0" />
				{showText && (
					<div className="overflow-hidden">
						<h1 className="text-sm font-bold truncate tracking-tight text-dash-text">ClaudeKit</h1>
						<p className="text-[10px] text-dash-text-muted font-medium uppercase tracking-wider">
							{t("controlCenter")}
						</p>
					</div>
				)}
			</div>

			{/* Settings Section */}
			<div className={`${showText ? "px-4" : "px-2"} py-2 space-y-1`}>
				{showText && (
					<p className="px-2 pb-2 text-[10px] font-bold text-dash-text-muted uppercase tracking-widest">
						{t("settingsSection")}
					</p>
				)}
				<SidebarItem
					icon={
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
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					}
					label={t("configEditor")}
					isCollapsed={!showText}
					active={isGlobalConfigView}
					onClick={() => navigate("/config/global")}
				/>
				<SidebarItem
					icon={
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
								d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
							/>
						</svg>
					}
					label={t("skills")}
					isCollapsed={!showText}
					active={isSkillsView}
					onClick={() => navigate("/skills")}
				/>
			</div>

			{/* Projects List */}
			<div className={`flex-1 overflow-y-auto overflow-x-hidden ${showText ? "px-4" : "px-2"} py-2 space-y-1 border-t border-dash-border`}>
				{showText && (
					<p className="px-2 pb-2 pt-2 text-[10px] font-bold text-dash-text-muted uppercase tracking-widest">
						{t("projects")}
					</p>
				)}
				{sortedProjects.map((project) => {
					// Highlight when on project dashboard (not config pages)
					const isProjectConfigView = location.pathname.endsWith("/config");
					const isActiveProject =
						currentProjectId === project.id && !isGlobalConfigView && !isProjectConfigView;
					return (
						<button
							key={project.id}
							onClick={() => onSwitchProject(project.id)}
							className={`w-full group relative flex items-center ${showText ? "gap-3 p-2.5" : "justify-center p-2"} rounded-md transition-colors ${
								isActiveProject
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
								} ${isActiveProject ? "animate-pulse" : ""}`}
							/>
							{showText && (
								<>
									{project.pinned && <span className="text-xs">📌</span>}
									<span className="text-sm font-medium truncate">{project.name}</span>
								</>
							)}
							{!showText && (
								<div className="absolute left-14 px-2 py-1 bg-dash-text text-dash-bg text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-dash-border z-50">
									{project.pinned && "📌 "}
									{project.name}
								</div>
							)}
						</button>
					);
				})}

				<button
					onClick={() => setIsAddModalOpen(true)}
					className={`w-full flex items-center ${showText ? "gap-3 p-2.5" : "justify-center p-2"} rounded-md text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text-secondary transition-colors mt-4`}
				>
					<div className={`${showText ? "w-5 h-5" : ""} flex items-center justify-center`}>
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
					{showText && <span className="text-sm font-medium">{t("addProject")}</span>}
				</button>
			</div>

			<AddProjectModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
				onAdd={onAddProject}
			/>

			{/* Footer Controls */}
			<div className="border-t border-dash-border">
				{/* Status & Controls Row */}
				<div
					className={`py-3 flex items-center ${showText ? "px-3 justify-between" : "justify-center flex-col gap-2"}`}
				>
					{/* SYNC Status */}
					<div className="flex items-center gap-2" title={isConnected ? t("sync") : t("offline")}>
						<div
							className={`w-2 h-2 rounded-full shrink-0 ${
								isConnected
									? "bg-dash-accent shadow-[0_0_8px_var(--dash-accent-glow)]"
									: "bg-red-500"
							}`}
						/>
						{showText && (
							<span className="text-[10px] font-bold text-dash-text-muted uppercase tracking-widest">
								{isConnected ? t("sync") : t("offline")}
							</span>
						)}
					</div>

					{/* Controls Group */}
					<div className={`flex items-center gap-1 ${showText ? "" : "flex-col"}`}>
						<LanguageSwitcher vertical={!showText} />
						<button
							onClick={onToggleTheme}
							className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
							title={theme === "dark" ? t("switchToLight") : t("switchToDark")}
						>
							{theme === "dark" ? (
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
										d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z"
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
										d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
									/>
								</svg>
							)}
						</button>
						<button
							onClick={onToggle}
							className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
							title={isCollapsed ? t("expand") : t("collapse")}
						>
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
						</button>
					</div>
				</div>
			</div>
		</aside>
	);
};

interface SidebarItemProps {
	icon: React.ReactNode;
	label: string;
	badge?: string;
	badgeColor?: string;
	isCollapsed: boolean;
	active?: boolean;
	onClick: () => void;
	disabled?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
	icon,
	label,
	badge,
	badgeColor = "bg-dash-accent-subtle text-dash-accent",
	isCollapsed,
	active,
	onClick,
	disabled,
}) => (
	<button
		onClick={onClick}
		disabled={disabled}
		className={`w-full group relative flex items-center ${isCollapsed ? "justify-center p-2" : "gap-3 p-2"} rounded-md transition-colors ${
			disabled
				? "opacity-50 cursor-not-allowed"
				: active
					? "bg-dash-surface-hover text-dash-text"
					: "text-dash-text-secondary hover:bg-dash-surface-hover hover:text-dash-text"
		}`}
	>
		<div className={`${isCollapsed ? "" : "w-5 h-5"} flex items-center justify-center`}>{icon}</div>
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
			<div className="absolute left-14 px-2 py-1 bg-dash-text text-dash-bg text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-dash-border z-50">
				{label}
			</div>
		)}
	</button>
);

export default Sidebar;
