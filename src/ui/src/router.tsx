/**
 * App router configuration
 * Routes: / (home), /config/global, /project/:id, /project/:id/config, /config/project/:projectId
 */
import { Navigate, createBrowserRouter } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ConfigEditorPage from "./pages/ConfigEditorPage";
import GlobalConfigPage from "./pages/GlobalConfigPage";
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
				element: <ProjectDashboardPage />,
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
				path: "project/:projectId/config",
				element: <ConfigEditorPage />,
			},
			{
				path: "onboarding",
				element: <OnboardingPage />,
			},
			{
				path: "*",
				element: <Navigate to="/" replace />,
			},
		],
	},
]);
