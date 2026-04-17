/**
 * Main app layout with sidebar and content outlet
 * Handles theme, project selection, and sidebar state
 * Each page owns its own header/controls — no global Header component
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import ResizeHandle from "../components/ResizeHandle";
import SearchPalette from "../components/SearchPalette";
import Sidebar from "../components/Sidebar";
import { useProjects } from "../hooks";
import { useDesktopOnboardingGate } from "../hooks/use-desktop-onboarding-gate";
import { isTauri } from "../hooks/use-tauri";
import { useUpdater } from "../hooks/use-updater";
import { useResizable } from "../hooks/useResizable";
import { useI18n } from "../i18n";
import { touchProject } from "../services/api";
import type { AppLayoutContext } from "./app-layout-context";

interface TrayOpenPayload {
	destination: "dashboard" | "project" | "settings";
	projectId?: string | null;
}

const AppLayout: React.FC = () => {
	const { t } = useI18n();
	const navigate = useNavigate();
	const location = useLocation();
	const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
	const desktopMode = isTauri();

	// Wire updater listener for Tauri desktop mode.
	// No visible UI yet — update badge will be added in a future phase.
	// updateAvailable is kept here so it can be passed down when needed.
	const { updateAvailable: _updateAvailable } = useUpdater();

	// Track last selected project even when on non-project routes (e.g., /config/global)
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

	// Update selected project when URL changes to a project route
	useEffect(() => {
		if (urlProjectId) {
			setSelectedProjectId(urlProjectId);
		}
	}, [urlProjectId]);

	useEffect(() => {
		if (!desktopMode) return;

		let cancelled = false;
		let unlisten: (() => void) | undefined;

		void (async () => {
			try {
				const { listen } = await import("@tauri-apps/api/event");
				if (cancelled) return;
				const nextUnlisten = await listen<TrayOpenPayload>("tray-open", (event) => {
					const payload = event.payload;
					if (!payload) return;
					if (payload.destination === "project" && payload.projectId) {
						navigate(`/project/${encodeURIComponent(payload.projectId)}`);
						return;
					}
					if (payload.destination === "settings") {
						// TODO: tray.rs currently emits settings with no projectId.
						// Keep the project-scoped branch ready for a future tray shortcut.
						if (payload.projectId) {
							navigate(`/config/project/${encodeURIComponent(payload.projectId)}`);
							return;
						}
						navigate("/config/global");
						return;
					}
					navigate("/dashboard");
				});
				if (cancelled) {
					nextUnlisten();
					return;
				}
				unlisten = nextUnlisten;
			} catch (error) {
				if (!cancelled) {
					console.error("[desktop-tray] Failed to register tray-open listener", error);
				}
			}
		})();

		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [desktopMode, navigate]);

	const [theme, setTheme] = useState<"light" | "dark">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("claudekit-theme");
			return (saved as "light" | "dark") || "dark";
		}
		return "dark";
	});

	const [isConnected] = useState(true);
	const [searchOpen, setSearchOpen] = useState(false);

	// Global Cmd+K / Ctrl+K listener
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setSearchOpen((prev) => !prev);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	// Resizable sidebar: min 80px (collapsed), max 400px, default 288px (w-72)
	const {
		size: sidebarWidth,
		isDragging: isSidebarDragging,
		startDrag: startSidebarDrag,
		setSize: setSidebarWidth,
	} = useResizable({
		storageKey: "claudekit-sidebar-width",
		defaultSize: 288,
		minSize: 56,
		maxSize: 400,
	});

	// Collapsed = at minimum size (80px)
	const isSidebarCollapsed = sidebarWidth <= 56;

	const {
		projects,
		loading: projectsLoading,
		error: projectsError,
		addProject: addProjectOriginal,
		reload: reloadProjects,
	} = useProjects();
	const {
		checking: onboardingChecking,
		shouldShowOnboarding,
		dismissOnboarding,
	} = useDesktopOnboardingGate({ projectCount: projects.length, projectsLoading });

	const handleAddProject = async (request: Parameters<typeof addProjectOriginal>[0]) => {
		await addProjectOriginal(request);
	};

	// Auto-select first project only on project dashboard route (not index or config)
	// Index route redirects to /config/global via router — don't override it here
	useEffect(() => {
		const isProjectRoute = location.pathname.startsWith("/project/");
		if (projects.length === 0 || urlProjectId || !isProjectRoute) return;
		navigate(`/project/${projects[0].id}`, { replace: true });
	}, [projects, urlProjectId, navigate, location.pathname]);

	useEffect(() => {
		if (!desktopMode || onboardingChecking) return;
		if (shouldShowOnboarding && location.pathname !== "/onboarding") {
			navigate("/onboarding", { replace: true });
		}
	}, [desktopMode, location.pathname, navigate, onboardingChecking, shouldShowOnboarding]);

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

	useEffect(() => {
		if (!desktopMode || !urlProjectId) return;
		const encodedProjectId = encodeURIComponent(urlProjectId);
		const matchesProjectRoute = (prefix: string) =>
			location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);
		const isProjectScopedRoute =
			matchesProjectRoute(`/project/${urlProjectId}`) ||
			matchesProjectRoute(`/project/${encodedProjectId}`) ||
			matchesProjectRoute(`/config/project/${urlProjectId}`) ||
			matchesProjectRoute(`/config/project/${encodedProjectId}`) ||
			matchesProjectRoute(`/sessions/${urlProjectId}`) ||
			matchesProjectRoute(`/sessions/${encodedProjectId}`);
		if (!isProjectScopedRoute) {
			return;
		}
		const routeProject = projects.find((project) => project.id === urlProjectId);
		if (!routeProject?.path) return;
		void touchProject(routeProject.path).catch((error) => {
			console.error("[desktop-tray] Failed to touch project recency", error);
		});
	}, [desktopMode, location.pathname, projects, urlProjectId]);

	const handleSwitchProject = (id: string) => {
		navigate(`/project/${id}`);
	};

	const handleToggleSidebar = () => {
		// Toggle between collapsed (80px) and expanded (288px)
		setSidebarWidth(isSidebarCollapsed ? 288 : 56);
	};

	if (projectsLoading || (desktopMode && onboardingChecking)) {
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

	const showChromelessOnboarding = desktopMode && location.pathname === "/onboarding";
	const outletContext: AppLayoutContext = {
		project: currentProject,
		isConnected,
		theme,
		onToggleTheme: toggleTheme,
		reloadProjects,
		dismissDesktopOnboarding: dismissOnboarding,
	};

	if (showChromelessOnboarding) {
		return (
			<div className="flex h-screen w-full bg-dash-bg text-dash-text overflow-hidden font-sans transition-colors duration-300">
				<main className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
					<Outlet context={outletContext} />
				</main>
			</div>
		);
	}

	return (
		<div className="flex h-screen w-full bg-dash-bg text-dash-text overflow-hidden font-sans transition-colors duration-300">
			<SearchPalette open={searchOpen} projects={projects} onClose={() => setSearchOpen(false)} />
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
				<main className="flex-1 flex flex-col overflow-hidden p-4 md:p-6">
					{/* Always render Outlet - pages handle their own project requirements */}
					<Outlet context={outletContext} />
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
