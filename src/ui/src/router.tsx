/**
 * App router configuration
 * Routes: / (home/system), /dashboard, /config/global, /project/:id, /config/project/:projectId,
 *         /migrate, /plans, /statusline, /agents, /commands, /skills, /mcp
 *
 * Entity browsers use split-panel layout (list + inline detail) — no separate detail routes.
 *
 * Sessions are accessed via project dashboard (/project/:id) or deep-link routes:
 *   /sessions/:projectId/:sessionId — individual session detail (read-only)
 * The standalone /sessions page has been removed; session data is shown in sidebar project items.
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
import PlanDetailPage from "./pages/PlanDetailPage";
import PlanReaderPage from "./pages/PlanReaderPage";
import PlansPage from "./pages/PlansPage";
import ProjectConfigPage from "./pages/ProjectConfigPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import SkillsBrowserPage from "./pages/SkillsBrowserPage";
import StatuslineBuilderPage from "./pages/StatuslineBuilderPage";
import SystemPage from "./pages/SystemPage";
import WorkflowsPage from "./pages/WorkflowsPage";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <AppLayout />,
		children: [
			{
				index: true,
				element: <SystemPage />,
			},
			{
				path: "dashboard",
				element: <SystemPage />,
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
				path: "plans",
				element: <PlansPage />,
			},
			{
				path: "plans/:planSlug",
				element: <PlanDetailPage />,
			},
			{
				path: "plans/:planSlug/read",
				element: <PlanReaderPage />,
			},
			{
				path: "plans/:planSlug/read/*",
				element: <PlanReaderPage />,
			},
			{
				// Legacy compatibility route for stale /kanban deep links.
				path: "kanban",
				element: <KanbanPage />,
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
				path: "workflows",
				element: <WorkflowsPage />,
			},
			{
				path: "*",
				element: <Navigate to="/" replace />,
			},
		],
	},
]);
