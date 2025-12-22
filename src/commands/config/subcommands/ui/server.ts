import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@/shared/logger.js";
import express from "express";
import pc from "picocolors";

const DEFAULT_PORT = 3847;
const AVOID_PORTS = [3000, 4000, 5000, 8080, 8000, 8888];
const PORT_RANGE = { min: 3848, max: 3899 };

export interface DashboardOptions {
	port?: number;
	open?: boolean;
}

export async function launchDashboard(options: DashboardOptions = {}): Promise<void> {
	const app = express();
	const server = createServer(app);

	// Find available port
	const port = await findAvailablePort(options.port ?? DEFAULT_PORT);

	// Setup middleware
	app.use(express.json());

	// Setup API routes
	const { setupApiRoutes } = await import("./api-routes.js");
	setupApiRoutes(app);

	// Setup WebSocket
	const { setupWebSocket } = await import("./websocket.js");
	setupWebSocket(server);

	// Serve static files from dashboard dist
	const distPath = getDashboardDistPath();
	if (existsSync(distPath)) {
		app.use(express.static(distPath));

		// SPA fallback - serve index.html for all non-API routes
		app.get("/{*splat}", (_req, res) => {
			if (!_req.path.startsWith("/api/")) {
				res.sendFile(join(distPath, "index.html"));
			}
		});
	} else {
		logger.warning("Dashboard dist not found, serving API only");
		app.get("/", (_req, res) => {
			res.json({
				message: "ClaudeKit Config Dashboard API",
				endpoints: [
					"GET /api/config",
					"POST /api/config",
					"GET /api/schema",
					"POST /api/validate",
					"GET /api/preview",
				],
			});
		});
	}

	// Start server
	return new Promise((resolve, reject) => {
		server.listen(port, () => {
			const url = `http://localhost:${port}`;
			console.log(`\n${pc.cyan("ClaudeKit Config Dashboard")}`);
			console.log(`${pc.dim("━".repeat(40))}`);
			console.log(`${pc.green("Running at:")} ${pc.bold(url)}`);
			console.log(`${pc.dim("Press Ctrl+C to stop")}\n`);

			// Auto-open browser
			if (options.open !== false) {
				openBrowser(url);
			}

			// Keep server running
			process.on("SIGINT", () => {
				console.log(pc.dim("\nShutting down..."));
				server.close(() => {
					resolve();
					process.exit(0);
				});
			});
		});

		server.on("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EADDRINUSE") {
				logger.error(`Port ${port} is already in use`);
				reject(new Error(`Port ${port} is already in use`));
			} else {
				reject(error);
			}
		});
	});
}

async function findAvailablePort(preferred: number): Promise<number> {
	// Dynamic import get-port
	const { default: getPort } = await import("get-port");

	// First try preferred port
	const port = await getPort({
		port: [preferred, ...generatePortRange()],
	});

	if (port !== preferred) {
		logger.info(`Port ${preferred} unavailable, using ${port}`);
	}

	return port;
}

function generatePortRange(): number[] {
	const ports: number[] = [];
	for (let p = PORT_RANGE.min; p <= PORT_RANGE.max; p++) {
		if (!AVOID_PORTS.includes(p)) {
			ports.push(p);
		}
	}
	return ports;
}

function getDashboardDistPath(): string {
	// When bundled in npm package, dist is at package/dashboard/dist
	const __dirname = dirname(fileURLToPath(import.meta.url));

	// Development: relative to src
	const devPath = join(__dirname, "../../../../../dashboard/dist");
	if (existsSync(devPath)) return devPath;

	// Production: relative to dist/
	const prodPath = join(__dirname, "../../../../dashboard/dist");
	if (existsSync(prodPath)) return prodPath;

	// Fallback: workspace root
	const workspacePath = join(process.cwd(), "dashboard/dist");
	return workspacePath;
}

async function openBrowser(url: string): Promise<void> {
	const { platform } = await import("node:os");
	const { spawn } = await import("node:child_process");

	const os = platform();
	let command: string;
	let args: string[];

	switch (os) {
		case "darwin":
			command = "open";
			args = [url];
			break;
		case "win32":
			command = "cmd";
			args = ["/c", "start", url];
			break;
		default:
			command = "xdg-open";
			args = [url];
	}

	try {
		spawn(command, args, { stdio: "ignore", detached: true }).unref();
	} catch {
		// Ignore browser open failures
		logger.debug("Could not open browser automatically");
	}
}
