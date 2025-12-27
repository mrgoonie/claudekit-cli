/**
 * App router configuration
 * Routes: / (home), /project/:id (dashboard), /project/:id/config (editor)
 */
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ConfigEditorPage from "./pages/ConfigEditorPage";
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
