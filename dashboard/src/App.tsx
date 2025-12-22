import { useCallback } from "react";
import {
	createRouter,
	createRootRoute,
	createRoute,
	RouterProvider,
	Outlet,
} from "@tanstack/react-router";
import { ProjectProvider } from "./contexts/ProjectContext";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ConfigPage } from "./pages/ConfigPage";
import { Toaster } from "./components/ui/toaster";
import { useWebSocket } from "./hooks/useWebSocket";
import { useToast } from "./hooks/useToast";

// Root layout component with WebSocket connection
function RootLayout() {
	const { toast } = useToast();

	const handleConfigChange = useCallback(() => {
		// Config changed externally, could trigger a reload
		toast({
			title: "Config Updated",
			description: "Configuration was modified externally",
			variant: "default",
		});
	}, [toast]);

	const handleReconnect = useCallback(() => {
		toast({
			title: "Reconnected",
			description: "WebSocket connection restored",
			variant: "default",
		});
	}, [toast]);

	const { connected } = useWebSocket(handleConfigChange, handleReconnect);

	return (
		<AppLayout connected={connected}>
			<Outlet />
		</AppLayout>
	);
}

// Define routes
const rootRoute = createRootRoute({
	component: RootLayout,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: DashboardPage,
});

const configRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/config",
	component: ConfigPage,
});

// Create route tree
const routeTree = rootRoute.addChildren([indexRoute, configRoute]);

// Create router instance
const router = createRouter({ routeTree });

// Register router for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

function App() {
	return (
		<ProjectProvider>
			<RouterProvider router={router} />
			<Toaster />
		</ProjectProvider>
	);
}

export default App;
