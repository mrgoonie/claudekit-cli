/**
 * App router configuration
 * Routes: / (home), /config/global, /project/:id, /config/project/:projectId, /migrate
 */
import { Navigate, createBrowserRouter } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import GlobalConfigPage from "./pages/GlobalConfigPage";
import MigratePage from "./pages/MigratePage";
import OnboardingPage from "./pages/OnboardingPage";
import ProjectConfigPage from "./pages/ProjectConfigPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";

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
				path: "migrate",
				element: <MigratePage />,
			},
			{
				path: "skills",
				element: <Navigate to="/migrate" replace />,
			},
			{
				path: "*",
				element: <Navigate to="/" replace />,
			},
		],
	},
]);
