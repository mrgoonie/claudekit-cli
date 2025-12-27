/**
 * Main app layout with sidebar, header, and content outlet
 * Handles theme, project selection, and sidebar state
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useProjects } from "../hooks";
import { useI18n } from "../i18n";

const AppLayout: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { projectId } = useParams<{ projectId?: string }>();

	const [theme, setTheme] = useState<"light" | "dark">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("claudekit-theme");
			return (saved as "light" | "dark") || "dark";
		}
		return "dark";
	});

	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [isConnected] = useState(true);

	const {
		projects,
		loading: projectsLoading,
		error: projectsError,
		addProject: addProjectOriginal,
	} = useProjects();

	const handleAddProject = async (request: Parameters<typeof addProjectOriginal>[0]) => {
		await addProjectOriginal(request);
	};

	// Auto-select first project if none selected
	useEffect(() => {
		if (projects.length === 0 || projectId) return;
		navigate(`/project/${projects[0].id}`, { replace: true });
	}, [projects, projectId, navigate]);

	useEffect(() => {
		const root = window.document.documentElement;
		if (theme === "dark") {
			root.classList.add("dark");
			root.setAttribute("data-theme", "dark");
		} else {
			root.classList.remove("dark");
			root.setAttribute("data-theme", "light");
		}
		localStorage.setItem("claudekit-theme", theme);
	}, [theme]);

	const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

	const currentProject = useMemo(
		() => projects.find((p) => p.id === projectId) || null,
		[projects, projectId],
	);

	const handleSwitchProject = (id: string) => {
		navigate(`/project/${id}`);
	};

	const handleToggleSidebar = () => {
		setIsSidebarCollapsed((prev) => !prev);
	};

	if (projectsLoading) {
		return (
			<div className="flex h-screen w-full bg-dash-bg text-dash-text items-center justify-center">
				<div className="animate-pulse text-dash-text-muted">{t("loading")}</div>
			</div>
		);
	}

	if (projectsError) {
		return (
			<div className="flex h-screen w-full bg-dash-bg text-dash-text items-center justify-center">
				<div className="text-red-500">
					{t("error")}: {projectsError}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen w-full bg-dash-bg text-dash-text overflow-hidden font-sans transition-colors duration-300">
			<Sidebar
				projects={projects}
				currentProjectId={projectId || null}
				isCollapsed={isSidebarCollapsed}
				onSwitchProject={handleSwitchProject}
				onToggle={handleToggleSidebar}
				onAddProject={handleAddProject}
			/>

			<div className="flex-1 flex flex-col min-w-0 h-full relative">
				<Header
					project={currentProject}
					isConnected={isConnected}
					theme={theme}
					onToggleTheme={toggleTheme}
				/>

				<main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
					{currentProject ? (
						<Outlet context={{ project: currentProject }} />
					) : (
						<div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
							<div className="w-16 h-16 rounded-full bg-dash-surface border border-dash-border flex items-center justify-center">
								<span className="text-2xl text-dash-text-muted">📂</span>
							</div>
							<p className="text-lg text-dash-text-secondary font-bold">{t("selectProject")}</p>
						</div>
					)}
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
