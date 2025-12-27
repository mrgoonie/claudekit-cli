/**
 * App router configuration
 * Routes: / (home), /config/global, /project/:id, /project/:id/config
 */
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ConfigEditorPage from "./pages/ConfigEditorPage";
import GlobalConfigPage from "./pages/GlobalConfigPage";
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
				path: "project/:projectId",
				element: <ProjectDashboardPage />,
			},
			{
				path: "project/:projectId/config",
				element: <ConfigEditorPage />,
			},
			{
				path: "*",
				element: <Navigate to="/" replace />,
			},
		],
	},
]);
