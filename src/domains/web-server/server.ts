/**
 * Express server with REST API, WebSocket, and static serving
 */

import { type Server, createServer } from "node:http";
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

	// Static serving (prod) or Vite proxy (dev)
	if (devMode) {
		await setupViteDevServer(app);
	} else {
		serveStatic(app);
	}

	// Error handler (must be last)
	app.use(errorHandler);

	// Create HTTP server
	const server: Server = createServer(app);

	// Configure server timeouts
	server.setTimeout(30000);
	server.keepAliveTimeout = 65000;
	server.headersTimeout = 66000;

	// Initialize WebSocket
	const wsManager = new WebSocketManager(server);

	// Initialize file watcher
	const fileWatcher = new FileWatcher({ wsManager });
	fileWatcher.start();

	// Start listening
	await new Promise<void>((resolve, reject) => {
		server.listen(port, () => resolve());
		server.on("error", reject);
	});

	logger.debug(`Server listening on port ${port}`);

	// Open browser
	if (openBrowser) {
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

async function setupViteDevServer(app: Express): Promise<void> {
	// Dynamic import to avoid bundling Vite in production
	try {
		// @ts-expect-error - Vite is optional dev dependency
		const { createServer: createViteServer } = await import("vite");

		const vite = await createViteServer({
			root: new URL("../../ui", import.meta.url).pathname,
			server: { middlewareMode: true },
			appType: "spa",
		});

		app.use(vite.middlewares);
		logger.debug("Vite dev server attached");
	} catch (error) {
		logger.warning("Vite not available for dev mode. Install with: bun add -d vite");
		serveStatic(app);
	}
}
