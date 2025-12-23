/**
 * WebSocket manager for real-time updates
 */

import type { Server } from "node:http";
import { logger } from "@/shared/logger.js";
import { WebSocket, WebSocketServer } from "ws";

export interface WSMessage {
	type: string;
	payload: unknown;
}

export class WebSocketManager {
	private wss: WebSocketServer;
	private clients: Set<WebSocket> = new Set();
	private pingInterval: NodeJS.Timeout | null = null;

	constructor(server: Server) {
		this.wss = new WebSocketServer({ server, path: "/ws" });
		this.setupServer();
	}

	private setupServer(): void {
		this.wss.on("connection", (ws: WebSocket) => {
			logger.debug("WebSocket client connected");
			this.clients.add(ws);

			ws.on("message", (data: Buffer) => {
				try {
					const message = JSON.parse(data.toString()) as WSMessage;
					this.handleMessage(ws, message);
				} catch (err) {
					logger.debug(`Invalid WS message: ${err}`);
				}
			});

			ws.on("close", () => {
				logger.debug("WebSocket client disconnected");
				this.clients.delete(ws);
			});

			ws.on("error", (err) => {
				logger.debug(`WebSocket error: ${err.message}`);
				this.clients.delete(ws);
			});

			// Send initial connection confirmation
			this.send(ws, { type: "connected", payload: { timestamp: Date.now() } });
		});

		// Heartbeat to detect dead connections
		this.pingInterval = setInterval(() => {
			this.clients.forEach((ws) => {
				if (ws.readyState === WebSocket.OPEN) {
					ws.ping();
				}
			});
		}, 30000);

		logger.debug("WebSocket server initialized");
	}

	private handleMessage(ws: WebSocket, message: WSMessage): void {
		switch (message.type) {
			case "subscribe":
				logger.debug(`Client subscribed: ${JSON.stringify(message.payload)}`);
				break;
			case "ping":
				this.send(ws, { type: "pong", payload: { timestamp: Date.now() } });
				break;
			default:
				logger.debug(`Unknown message type: ${message.type}`);
		}
	}

	send(ws: WebSocket, message: WSMessage): void {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	broadcast(message: WSMessage): void {
		const data = JSON.stringify(message);
		this.clients.forEach((ws) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(data);
			}
		});
		logger.debug(`Broadcast to ${this.clients.size} clients: ${message.type}`);
	}

	close(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
		}
		this.clients.forEach((ws) => ws.close());
		this.wss.close();
		logger.debug("WebSocket server closed");
	}

	get clientCount(): number {
		return this.clients.size;
	}
}
