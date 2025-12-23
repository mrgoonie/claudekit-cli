import ConfigEditor from "@/components/ConfigEditor";
import Header from "@/components/Header";
import ProjectDashboard from "@/components/ProjectDashboard";
import Sidebar from "@/components/Sidebar";
import { useConfig } from "@/hooks/useConfig";
import { useProjects } from "@/hooks/useProjects";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useCallback, useEffect, useState } from "react";

export default function App() {
	const [theme, setTheme] = useState<"light" | "dark">(() => {
		const saved = localStorage.getItem("claudekit-theme");
		return (saved as "light" | "dark") || "dark";
	});

	const [view, setView] = useState<"dashboard" | "config">("dashboard");
	const [currentProjectId, setCurrentProjectId] = useState<string>("current");
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	const {
		config,
		loading: configLoading,
		error: configError,
		update: updateConfig,
		reload: reloadConfig,
	} = useConfig();
	const { projects, loading: projectsLoading, reload: reloadProjects } = useProjects();

	// WebSocket message handler for real-time updates
	const handleWsMessage = useCallback(
		(message: { type: string; payload: unknown }) => {
			if (message.type === "config:updated") {
				reloadConfig();
			} else if (message.type === "file:changed") {
				// Reload both config and projects on file changes
				reloadConfig();
				reloadProjects();
			}
		},
		[reloadConfig, reloadProjects],
	);

	const { isConnected } = useWebSocket({
		onMessage: handleWsMessage,
		onConnect: () => {
			// Reload data on reconnect to ensure fresh state
			reloadConfig();
			reloadProjects();
		},
	});

	// Theme effect
	useEffect(() => {
		const root = document.documentElement;
		if (theme === "dark") {
			root.classList.add("dark");
			root.setAttribute("data-theme", "dark");
		} else {
			root.classList.remove("dark");
			root.setAttribute("data-theme", "light");
		}
		localStorage.setItem("claudekit-theme", theme);
	}, [theme]);

	const currentProject = projects.find((p) => p.id === currentProjectId) || null;

	return (
		<div className="flex h-screen w-full bg-dash-bg text-dash-text overflow-hidden font-sans transition-colors duration-300">
			<Sidebar
				projects={projects}
				currentProjectId={currentProjectId}
				isCollapsed={sidebarCollapsed}
				onSwitchProject={setCurrentProjectId}
				onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
				activeView={view}
				onSetView={setView}
			/>

			<div className="flex-1 flex flex-col min-w-0 h-full">
				<Header
					project={currentProject}
					isConnected={isConnected}
					onOpenConfig={() => setView("config")}
					theme={theme}
					onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
				/>

				<main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
					{configLoading || projectsLoading ? (
						<div className="flex items-center justify-center h-full">
							<div className="animate-spin h-8 w-8 border-2 border-dash-accent border-t-transparent rounded-full" />
						</div>
					) : view === "dashboard" && currentProject ? (
						<ProjectDashboard project={currentProject} config={config} />
					) : view === "config" && config ? (
						<ConfigEditor
							config={config}
							onSave={updateConfig}
							onBack={() => setView("dashboard")}
						/>
					) : (
						<div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
							<p className="text-lg text-dash-text-secondary font-bold">
								{configError || "Select a project"}
							</p>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
