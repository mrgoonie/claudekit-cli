/**
 * Express server with REST API, WebSocket, and static serving
 */

import { type Server, createServer } from "node:http";
import { createConnection } from "node:net";
import { logger } from "@/shared/logger.js";
import express, { type Express } from "express";
import getPort from "get-port";
import open from "open";
import { FileWatcher } from "./file-watcher.js";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { registerRoutes } from "./routes/index.js";
import { serveStatic } from "./static-server.js";
import type { ServerInstance, ServerOptions } from "./types.js";
import { WebSocketManager } from "./websocket-manager.js";

export async function createAppServer(options: ServerOptions = {}): Promise<ServerInstance> {
	const { port: preferredPort, openBrowser = true, devMode = false } = options;

	// Get available port
	const port = await getPort({ port: preferredPort || [3456, 3457, 3458, 3459, 3460] });

	// Create Express app
	const app: Express = express();

	// Middleware
	app.use(express.json({ limit: "10mb" }));
	app.use(corsMiddleware);

	// API routes
	registerRoutes(app);

	// Create HTTP server early so Vite HMR and WebSocket manager can share it
	const server: Server = createServer(app);

	// Configure server timeouts
	server.setTimeout(30000);
	server.keepAliveTimeout = 65000;
	server.headersTimeout = 66000;

	// Static serving (prod) or Vite dev server (dev)
	if (devMode) {
		await setupViteDevServer(app, server);
	} else {
		serveStatic(app);
	}

	// Error handler (must be last)
	app.use(errorHandler);

	// Initialize WebSocket (after Vite so paths don't conflict)
	const wsManager = new WebSocketManager(server);

	// Initialize file watcher
	const fileWatcher = new FileWatcher({ wsManager });
	fileWatcher.start();

	// Check if port was previously in use (restart detection — skip browser open)
	const portWasInUse = await isPortInUse(port);

	// Start listening
	await new Promise<void>((resolve, reject) => {
		server.listen(port, () => resolve());
		server.on("error", reject);
	});

	logger.debug(`Server listening on port ${port}`);

	// Open browser only on first launch (skip if port was already in use = restart)
	if (openBrowser && !portWasInUse) {
		try {
			await open(`http://localhost:${port}`);
		} catch (err) {
			logger.warning(`Failed to open browser: ${err instanceof Error ? err.message : err}`);
			logger.info(`Open http://localhost:${port} manually`);
		}
	}

	return {
		port,
		server,
		close: async () => {
			fileWatcher.stop();
			wsManager.close();
			return new Promise<void>((resolve) => {
				// Check if server is listening before closing
				if (!server.listening) {
					resolve();
					return;
				}
				server.close((err) => {
					if (err) {
						logger.debug(`Server close error: ${err.message}`);
					}
					resolve();
				});
			});
		},
	};
}

/** Check if a port is already in use (indicates server restart, not first launch) */
function isPortInUse(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: "127.0.0.1" });
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => {
			socket.destroy();
			resolve(false);
		});
	});
}

async function setupViteDevServer(app: Express, httpServer: Server): Promise<void> {
	const uiRoot = new URL("../../ui", import.meta.url).pathname;

	try {
		// Import vite from the UI node_modules where it's installed as a devDependency
		const viteEntry = `${uiRoot}/node_modules/vite/dist/node/index.js`;
		const { createServer: createViteServer } = await import(viteEntry);

		const vite = await createViteServer({
			configFile: `${uiRoot}/vite.config.ts`,
			root: uiRoot,
			server: {
				middlewareMode: true,
				hmr: { server: httpServer },
			},
			appType: "spa",
		});

		app.use(vite.middlewares);
		logger.info("Vite dev server attached (HMR enabled)");
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error(`[dashboard] Vite setup failed: ${msg}`);

		// In development mode, throw error instead of falling back to static
		const isDev = process.env.NODE_ENV !== "production";
		if (isDev) {
			throw error;
		}

		// Only use static fallback in production builds
		serveStatic(app);
	}
}
