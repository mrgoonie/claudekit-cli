/**
 * App router configuration
 * Routes: /config/global (home), /project/:id, /config/project/:projectId,
 *         /migrate, /kanban, /statusline, /agents, /commands, /skills, /mcp
 *
 * Entity browsers use split-panel layout (list + inline detail) — no separate detail routes.
 *
 * Sessions are accessed via project dashboard (/project/:id) or deep-link routes:
 *   /sessions/:projectId — project session list
 *   /sessions/:projectId/:sessionId — individual session detail
 */
import { Navigate, createBrowserRouter } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AgentsPage from "./pages/AgentsPage";
import CommandsPage from "./pages/CommandsPage";
import GlobalConfigPage from "./pages/GlobalConfigPage";
import KanbanPage from "./pages/KanbanPage";
import McpPage from "./pages/McpPage";
import MigratePage from "./pages/MigratePage";
import OnboardingPage from "./pages/OnboardingPage";
import ProjectConfigPage from "./pages/ProjectConfigPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import SessionProjectPage from "./pages/SessionProjectPage";
import SkillsBrowserPage from "./pages/SkillsBrowserPage";
import StatuslineBuilderPage from "./pages/StatuslineBuilderPage";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <AppLayout />,
		children: [
			{
				index: true,
				element: <Navigate to="/config/global" replace />,
			},
			{
				path: "dashboard",
				element: <Navigate to="/config/global" replace />,
			},
			{
				path: "config/global",
				element: <GlobalConfigPage />,
			},
			{
				path: "config/project/:projectId",
				element: <ProjectConfigPage />,
			},
			{
				path: "project/:projectId",
				element: <ProjectDashboardPage />,
			},
			{
				path: "onboarding",
				element: <OnboardingPage />,
			},
			{
				path: "migrate",
				element: <MigratePage />,
			},
			{
				path: "statusline",
				element: <StatuslineBuilderPage />,
			},
			{
				path: "mcp",
				element: <McpPage />,
			},
			{
				// CLI-only entry point — opened via `ck plan kanban <file>`, not linked in sidebar
				path: "kanban",
				element: <KanbanPage />,
			},
			{
				path: "sessions/:projectId",
				element: <SessionProjectPage />,
			},
			{
				path: "sessions/:projectId/:sessionId",
				element: <SessionDetailPage />,
			},
			{
				path: "agents",
				element: <AgentsPage />,
			},
			{
				path: "commands",
				element: <CommandsPage />,
			},
			{
				path: "skills",
				element: <SkillsBrowserPage />,
			},
			{
				path: "*",
				element: <Navigate to="/" replace />,
			},
		],
	},
]);
