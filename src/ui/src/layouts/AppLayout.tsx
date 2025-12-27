/**
 * Main app layout with sidebar, header, and content outlet
 * Handles theme, project selection, and sidebar state
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { useProjects } from "../hooks";
import { useI18n } from "../i18n";

const AppLayout: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();
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

	// Auto-select first project only on index route (not global config, etc.)
	useEffect(() => {
		const isIndexRoute = location.pathname === "/";
		if (projects.length === 0 || projectId || !isIndexRoute) return;
		navigate(`/project/${projects[0].id}`, { replace: true });
	}, [projects, projectId, navigate, location.pathname]);

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
					{/* Always render Outlet - pages handle their own project requirements */}
					<Outlet context={{ project: currentProject }} />
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
