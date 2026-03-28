/**
 * Dashboard launcher used by `ck config` (default) and `ck config ui` (alias)
 *
 * DEV QUICK START:
 *   bun run dashboard:dev
 *   → Express+Vite on http://localhost:3456 (auto-fallback 3456-3460)
 *   → DO NOT use `cd src/ui && bun dev` alone (no API backend)
 */

import { networkInterfaces } from "node:os";
import { logger } from "@/shared/logger.js";
import pc from "picocolors";
import type { ConfigUIOptions } from "./types.js";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const WILDCARD_HOSTS = new Set(["0.0.0.0", "::"]);

export async function configUICommand(options: ConfigUIOptions = {}): Promise<void> {
	const { port, dev = false } = options;
	const host = options.host?.trim() || undefined;
	// cac converts --no-open to { open: false }, handle both formats
	const noOpen = (options as Record<string, unknown>).open === false || options.noOpen === true;

	try {
		// Check if port is in use (when explicitly specified)
		if (port) {
			const isAvailable = await checkPort(port, host);
			if (!isAvailable) {
				logger.error(`Port ${port} is already in use`);
				logger.info("Try: ck config (auto-selects available port)");
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
			host,
		});

		const urls = getDashboardUrls(server.host, server.port);
		console.log();
		console.log(pc.bold("  ClaudeKit Dashboard"));
		console.log(pc.dim("  ─────────────────────"));
		if (urls.local) {
			console.log(`  ${pc.green("➜")} Local: ${pc.cyan(urls.local)}`);
		}
		for (const url of urls.network) {
			console.log(`  ${pc.green(urls.local ? "•" : "➜")} Network: ${pc.cyan(url)}`);
		}
		console.log(`  ${pc.green("•")} Bind: ${pc.cyan(server.host)}`);
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

async function checkPort(port: number, host?: string): Promise<boolean> {
	const { createServer } = await import("node:net");
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.once("listening", () => {
			server.close();
			resolve(true);
		});
		server.listen(port, host);
	});
}

function getDashboardUrls(host: string, port: number): { local: string | null; network: string[] } {
	if (WILDCARD_HOSTS.has(host)) {
		return {
			local: `http://localhost:${port}`,
			network: getDetectedNetworkUrls(port),
		};
	}

	if (LOOPBACK_HOSTS.has(host)) {
		return {
			local: `http://localhost:${port}`,
			network: [],
		};
	}

	return {
		local: null,
		network: [buildDashboardUrl(host, port)],
	};
}

function getDetectedNetworkUrls(port: number): string[] {
	const urls = new Set<string>();

	for (const addresses of Object.values(networkInterfaces())) {
		for (const address of addresses ?? []) {
			if (address.internal) {
				continue;
			}

			urls.add(buildDashboardUrl(address.address, port));
		}
	}

	return Array.from(urls).sort();
}

function buildDashboardUrl(host: string, port: number): string {
	const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
	return `http://${formattedHost}:${port}`;
}
