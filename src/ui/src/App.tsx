import type React from "react";
import { useEffect, useMemo, useState } from "react";
import ConfigEditor from "./components/ConfigEditor";
import Header from "./components/Header";
import ProjectDashboard from "./components/ProjectDashboard";
import Sidebar from "./components/Sidebar";
import { MOCK_PROJECTS } from "./services/mockData";
import type { AppState } from "./types";

const App: React.FC = () => {
	const [theme, setTheme] = useState<"light" | "dark">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("claudekit-theme");
			return (saved as "light" | "dark") || "dark";
		}
		return "dark";
	});

	const [state, setState] = useState<AppState>({
		projects: MOCK_PROJECTS,
		currentProjectId: MOCK_PROJECTS[0].id,
		isSidebarCollapsed: false,
		isConnected: true,
		view: "dashboard",
	});

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
		() => state.projects.find((p) => p.id === state.currentProjectId) || null,
		[state.projects, state.currentProjectId],
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

	return (
		<div className="flex h-screen w-full bg-dash-bg text-dash-text overflow-hidden font-sans transition-colors duration-300">
			<Sidebar
				projects={state.projects}
				currentProjectId={state.currentProjectId}
				isCollapsed={state.isSidebarCollapsed}
				onSwitchProject={handleSwitchProject}
				onToggle={handleToggleSidebar}
				activeView={state.view}
				onSetView={setView}
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
