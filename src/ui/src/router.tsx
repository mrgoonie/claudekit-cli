/**
 * App router configuration
 * Routes: / (home), /config/global, /project/:id, /config/project/:projectId,
 *         /migrate, /kanban, /statusline,
 *         /sessions, /sessions/:projectId, /sessions/:projectId/:sessionId
 */
import { Navigate, createBrowserRouter } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import GlobalConfigPage from "./pages/GlobalConfigPage";
import KanbanPage from "./pages/KanbanPage";
import McpPage from "./pages/McpPage";
import MigratePage from "./pages/MigratePage";
import OnboardingPage from "./pages/OnboardingPage";
import ProjectConfigPage from "./pages/ProjectConfigPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import SessionProjectPage from "./pages/SessionProjectPage";
import SessionsPage from "./pages/SessionsPage";
import SkillDetailPage from "./pages/SkillDetailPage";
import SkillsBrowserPage from "./pages/SkillsBrowserPage";
import StatuslineBuilderPage from "./pages/StatuslineBuilderPage";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <AppLayout />,
		children: [
			{
				index: true,
				element: <DashboardPage />,
			},
			{
				path: "dashboard",
				element: <DashboardPage />,
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
				path: "sessions",
				element: <SessionsPage />,
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
				path: "skills",
				element: <SkillsBrowserPage />,
			},
			{
				path: "skills/:name",
				element: <SkillDetailPage />,
			},
			{
				path: "*",
				element: <Navigate to="/" replace />,
			},
		],
	},
]);
