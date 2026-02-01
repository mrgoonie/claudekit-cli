/**
 * Main app layout with sidebar and content outlet
 * Handles theme, project selection, and sidebar state
 * Each page owns its own header/controls — no global Header component
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import ResizeHandle from "../components/ResizeHandle";
import Sidebar from "../components/Sidebar";
import { useProjects } from "../hooks";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";

const AppLayout: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();
	const { projectId: urlProjectId } = useParams<{ projectId?: string }>();

	// Track last selected project even when on non-project routes (e.g., /config/global)
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

	// Update selected project when URL changes to a project route
	useEffect(() => {
		if (urlProjectId) {
			setSelectedProjectId(urlProjectId);
		}
	}, [urlProjectId]);

	const [theme, setTheme] = useState<"light" | "dark">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("claudekit-theme");
			return (saved as "light" | "dark") || "dark";
		}
		return "dark";
	});

	const [isConnected] = useState(true);

	// Resizable sidebar: min 80px (collapsed), max 400px, default 288px (w-72)
	const {
		size: sidebarWidth,
		isDragging: isSidebarDragging,
		startDrag: startSidebarDrag,
		setSize: setSidebarWidth,
	} = useResizable({
		storageKey: "claudekit-sidebar-width",
		defaultSize: 288,
		minSize: 80,
		maxSize: 400,
	});

	// Collapsed = at minimum size (80px)
	const isSidebarCollapsed = sidebarWidth <= 80;

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
		if (projects.length === 0 || urlProjectId || !isIndexRoute) return;
		navigate(`/project/${projects[0].id}`, { replace: true });
	}, [projects, urlProjectId, navigate, location.pathname]);

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
		() => projects.find((p) => p.id === selectedProjectId) || null,
		[projects, selectedProjectId],
	);

	const handleSwitchProject = (id: string) => {
		navigate(`/project/${id}`);
	};

	const handleToggleSidebar = () => {
		// Toggle between collapsed (80px) and expanded (288px)
		setSidebarWidth(isSidebarCollapsed ? 288 : 80);
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
				currentProjectId={selectedProjectId}
				isCollapsed={isSidebarCollapsed}
				width={sidebarWidth}
				isConnected={isConnected}
				theme={theme}
				onSwitchProject={handleSwitchProject}
				onToggle={handleToggleSidebar}
				onAddProject={handleAddProject}
				onToggleTheme={toggleTheme}
			/>

			<ResizeHandle
				direction="horizontal"
				isDragging={isSidebarDragging}
				onMouseDown={startSidebarDrag}
			/>

			<div className="flex-1 flex flex-col min-w-0 h-full relative">
				<main className="flex-1 flex flex-col overflow-hidden p-6 md:p-8">
					{/* Always render Outlet - pages handle their own project requirements */}
					<Outlet
						context={{ project: currentProject, isConnected, theme, onToggleTheme: toggleTheme }}
					/>
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
