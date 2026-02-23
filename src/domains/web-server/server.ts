/**
 * Express server with REST API, WebSocket, and static serving
 */

import { type Server, createServer } from "node:http";
import { fileURLToPath } from "node:url";
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
		await setupViteDevServer(app, server, { failFast: true });
	} else {
		serveStatic(app);
	}

	// Error handler (must be last)
	app.use(errorHandler);

	// Initialize WebSocket (after Vite so paths don't conflict)
	const wsManager = new WebSocketManager(server);

	// Initialize file watcher
	const fileWatcher = new FileWatcher({ wsManager });
	try {
		fileWatcher.start();

		// Start listening
		await new Promise<void>((resolve, reject) => {
			const onListening = () => {
				server.off("error", onError);
				resolve();
			};
			const onError = (error: Error) => {
				server.off("listening", onListening);
				reject(error);
			};

			server.once("listening", onListening);
			server.once("error", onError);
			server.listen(port);
		});

		logger.debug(`Server listening on port ${port}`);

		if (openBrowser) {
			try {
				await open(`http://localhost:${port}`);
			} catch (err) {
				logger.warning(`Failed to open browser: ${err instanceof Error ? err.message : err}`);
				logger.info(`Open http://localhost:${port} manually`);
			}
		}
	} catch (error) {
		fileWatcher.stop();
		wsManager.close();
		await closeHttpServer(server);
		throw error;
	}

	return {
		port,
		server,
		close: async () => {
			fileWatcher.stop();
			wsManager.close();
			await closeHttpServer(server);
		},
	};
}

async function closeHttpServer(server: Server): Promise<void> {
	await new Promise<void>((resolve) => {
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
}

export function resolveUiRootPath(): string {
	return fileURLToPath(new URL("../../ui", import.meta.url));
}

async function setupViteDevServer(
	app: Express,
	httpServer: Server,
	options: { failFast: boolean },
): Promise<void> {
	const uiRoot = resolveUiRootPath();

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

		if (options.failFast) {
			throw error;
		}

		serveStatic(app);
	}
}
