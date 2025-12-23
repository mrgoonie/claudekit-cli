import type React from "react";
import { useEffect, useMemo, useState } from "react";
import ConfigEditor from "./components/ConfigEditor";
import Header from "./components/Header";
import ProjectDashboard from "./components/ProjectDashboard";
import Sidebar from "./components/Sidebar";
import { useProjects } from "./hooks";
import type { AppState } from "./types";

const App: React.FC = () => {
	const [theme, setTheme] = useState<"light" | "dark">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("claudekit-theme");
			return (saved as "light" | "dark") || "dark";
		}
		return "dark";
	});

	const {
		projects,
		loading: projectsLoading,
		error: projectsError,
		addProject: addProjectOriginal,
	} = useProjects();

	// Wrap addProject to match Sidebar's expected signature
	const handleAddProject = async (request: Parameters<typeof addProjectOriginal>[0]) => {
		await addProjectOriginal(request);
	};

	const [state, setState] = useState<Omit<AppState, "projects">>({
		currentProjectId: null,
		isSidebarCollapsed: false,
		isConnected: true,
		view: "dashboard",
	});

	// Set first project as current when projects load
	useEffect(() => {
		if (projects.length === 0) {
			setState((prev) => ({ ...prev, currentProjectId: null }));
			return;
		}

		// If current project still exists, keep it
		const currentExists = projects.some((p) => p.id === state.currentProjectId);
		if (currentExists) return;

		// Otherwise select first project
		setState((prev) => ({ ...prev, currentProjectId: projects[0].id }));
	}, [projects, state.currentProjectId]);

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
		() => projects.find((p) => p.id === state.currentProjectId) || null,
		[projects, state.currentProjectId],
	);

	const handleSwitchProject = (id: string) => {
		setState((prev) => ({ ...prev, currentProjectId: id, view: "dashboard" }));
	};

	const handleToggleSidebar = () => {
		setState((prev) => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }));
	};

	const setView = (view: AppState["view"]) => {
		setState((prev) => ({ ...prev, view }));
	};

	if (projectsLoading) {
		return (
			<div className="flex h-screen w-full bg-dash-bg text-dash-text items-center justify-center">
				<div className="animate-pulse text-dash-text-muted">Loading...</div>
			</div>
		);
	}

	if (projectsError) {
		return (
			<div className="flex h-screen w-full bg-dash-bg text-dash-text items-center justify-center">
				<div className="text-red-500">Error: {projectsError}</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen w-full bg-dash-bg text-dash-text overflow-hidden font-sans transition-colors duration-300">
			<Sidebar
				projects={projects}
				currentProjectId={state.currentProjectId}
				isCollapsed={state.isSidebarCollapsed}
				onSwitchProject={handleSwitchProject}
				onToggle={handleToggleSidebar}
				activeView={state.view}
				onSetView={setView}
				onAddProject={handleAddProject}
			/>

			<div className="flex-1 flex flex-col min-w-0 h-full relative">
				<Header
					project={currentProject}
					isConnected={state.isConnected}
					onOpenConfig={() => setView("config")}
					theme={theme}
					onToggleTheme={toggleTheme}
				/>

				<main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
					{state.view === "dashboard" && currentProject && (
						<ProjectDashboard project={currentProject} />
					)}

					{state.view === "config" && currentProject && (
						<ConfigEditor project={currentProject} onBack={() => setView("dashboard")} />
					)}

					{!currentProject && (
						<div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
							<div className="w-16 h-16 rounded-full bg-dash-surface border border-dash-border flex items-center justify-center">
								<span className="text-2xl text-dash-text-muted">📂</span>
							</div>
							<p className="text-lg text-dash-text-secondary font-bold">
								Select a project to view dashboard
							</p>
						</div>
					)}
				</main>
			</div>
		</div>
	);
};

export default App;
