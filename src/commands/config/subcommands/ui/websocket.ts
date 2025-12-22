import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { PathResolver } from "@/shared/path-resolver.js";
import { ResolutionTracer } from "@/domains/config/resolution-tracer.js";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { logger } from "@/shared/logger.js";

interface WsMessage {
	type: "config_changed" | "error" | "connected";
	data?: unknown;
}

export function setupWebSocket(server: Server): void {
	const wss = new WebSocketServer({ server, path: "/ws" });
	const watchers: FSWatcher[] = [];

	// Watch config files
	const watchPaths = [
		PathResolver.getConfigFile(true),
		join(process.cwd(), ".claude", ".ck.json"),
	];

	for (const path of watchPaths) {
		if (existsSync(path)) {
			try {
				const watcher = watch(
					path,
					{ persistent: false },
					async (eventType) => {
						if (eventType === "change") {
							logger.debug(`Config file changed: ${path}`);
							await broadcastConfigChange(wss);
						}
					},
				);
				watchers.push(watcher);
				logger.debug(`Watching: ${path}`);
			} catch (error) {
				logger.debug(`Could not watch ${path}: ${error}`);
			}
		}
	}

	wss.on("connection", (ws: WebSocket) => {
		logger.debug("WebSocket client connected");

		// Send initial state
		const message: WsMessage = { type: "connected" };
		ws.send(JSON.stringify(message));

		ws.on("close", () => {
			logger.debug("WebSocket client disconnected");
		});

		ws.on("error", (error) => {
			logger.debug(`WebSocket error: ${error}`);
		});
	});

	// Cleanup on server close
	server.on("close", () => {
		for (const watcher of watchers) {
			watcher.close();
		}
		wss.close();
	});
}

async function broadcastConfigChange(wss: WebSocketServer): Promise<void> {
	try {
		const projectDir = process.cwd();
		const result = await ResolutionTracer.trace(projectDir, false);

		const message: WsMessage = {
			type: "config_changed",
			data: {
				merged: unflatten(result.merged),
				traced: result.traced,
			},
		};

		const payload = JSON.stringify(message);

		for (const client of wss.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(payload);
			}
		}
	} catch (error) {
		logger.debug(`Failed to broadcast config change: ${error}`);
	}
}

function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		const keys = key.split(".");
		let current = result;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) current[keys[i]] = {};
			current = current[keys[i]] as Record<string, unknown>;
		}
		current[keys[keys.length - 1]] = value;
	}
	return result;
}
