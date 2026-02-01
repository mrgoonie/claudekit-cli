/**
 * Handler for `ck config ui` command - launches web dashboard
 *
 * DEV QUICK START:
 *   bun run dashboard:dev
 *   → Express+Vite on http://localhost:3456 (auto-fallback 3456-3460)
 *   → DO NOT use `cd src/ui && bun dev` alone (no API backend)
 */

import { logger } from "@/shared/logger.js";
import pc from "picocolors";
import type { ConfigUIOptions } from "./types.js";

export async function configUICommand(options: ConfigUIOptions = {}): Promise<void> {
	const { port, dev = false } = options;
	// cac converts --no-open to { open: false }, handle both formats
	const noOpen = (options as Record<string, unknown>).open === false || options.noOpen === true;

	try {
		// Check if port is in use (when explicitly specified)
		if (port) {
			const isAvailable = await checkPort(port);
			if (!isAvailable) {
				logger.error(`Port ${port} is already in use`);
				logger.info("Try: ck config ui (auto-selects available port)");
				process.exitCode = 1;
				return;
			}
		}

		logger.info("Starting ClaudeKit Dashboard...");

		// Dynamic import to avoid bundling web-server in main CLI
		const { startServer } = await import("@/domains/web-server/index.js");

		const server = await startServer({
			port,
			openBrowser: !noOpen,
			devMode: dev,
		});

		// Pretty print URL
		const url = `http://localhost:${server.port}`;
		console.log();
		console.log(pc.bold("  ClaudeKit Dashboard"));
		console.log(pc.dim("  ─────────────────────"));
		console.log(`  ${pc.green("➜")} Local: ${pc.cyan(url)}`);
		console.log();
		console.log(pc.dim("  Press Ctrl+C to stop"));
		console.log();

		// Keep alive until SIGINT/SIGTERM
		await new Promise<void>((resolve) => {
			const shutdown = async () => {
				console.log();
				logger.info("Shutting down...");
				await server.close();
				resolve();
			};

			process.on("SIGINT", shutdown);
			process.on("SIGTERM", shutdown);
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);

		if (msg.includes("EADDRINUSE")) {
			logger.error("Port already in use. Try a different port or let it auto-select.");
		} else if (msg.includes("EACCES")) {
			logger.error("Permission denied. Try a port above 1024.");
		} else if (msg.includes("Cannot find module") || msg.includes("web-server")) {
			logger.error("Web server module not yet implemented. Run `bun run build` after Phase 02.");
		} else {
			logger.error(`Failed to start dashboard: ${msg}`);
		}

		process.exitCode = 1;
	}
}

async function checkPort(port: number): Promise<boolean> {
	const { createServer } = await import("node:net");
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.once("listening", () => {
			server.close();
			resolve(true);
		});
		server.listen(port);
	});
}
