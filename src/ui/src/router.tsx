/**
 * App router configuration
 * Routes: / (home), /config/global, /project/:id, /config/project/:projectId,
 *         /skills, /health, /kits, /settings
 */
import { Navigate, createBrowserRouter } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import GlobalConfigPage from "./pages/GlobalConfigPage";
import HealthPage from "./pages/HealthPage";
import InsightsPage from "./pages/InsightsPage";
import KitCenterPage from "./pages/KitCenterPage";
import OnboardingPage from "./pages/OnboardingPage";
import ProjectConfigPage from "./pages/ProjectConfigPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import SettingsPage from "./pages/SettingsPage";
import SkillsPage from "./pages/SkillsPage";

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
				path: "skills",
				element: <SkillsPage />,
			},
			{
				path: "health",
				element: <HealthPage />,
			},
			{
				path: "kits",
				element: <KitCenterPage />,
			},
			{
				path: "settings",
				element: <SettingsPage />,
			},
			{
				path: "insights",
				element: <InsightsPage />,
			},
			{
				path: "*",
				element: <Navigate to="/" replace />,
			},
		],
	},
]);
