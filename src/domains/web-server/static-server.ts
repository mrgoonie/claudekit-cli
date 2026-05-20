/**
 * Static file server for production UI
 * Serves dashboard UI from dist/ui/ at runtime (npm install)
 */

import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@/shared/logger.js";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));

function addRuntimeUiCandidate(candidates: Set<string>, runtimePath?: string): void {
	if (!runtimePath) {
		return;
	}

	const looksLikePath =
		runtimePath.includes("/") || runtimePath.includes("\\") || existsSync(runtimePath);
	if (!looksLikePath) {
		return;
	}

	const entryDir = dirname(resolve(runtimePath));
	if (basename(entryDir) === "dist") {
		candidates.add(join(entryDir, "ui"));
	}
	candidates.add(join(entryDir, "..", "dist", "ui"));
}

export function resolveUiDistPath(): string {
	const candidates = new Set<string>();

	// Bun/Node execution: <package>/dist/index.js or <package>/bin/ck.js
	addRuntimeUiCandidate(candidates, process.argv[1]);
	// Production (npm install -g): dist/index.js → dist/ui/ (same directory)
	candidates.add(join(__dirname, "ui"));
	// Dev mode: running from CLI repo root
	candidates.add(join(process.cwd(), "dist", "ui"));
	// Dev mode alternative: src/ui/dist (if built there)
	candidates.add(join(process.cwd(), "src", "ui", "dist"));

	for (const path of candidates) {
		// Check if index.html exists to confirm it's a valid built UI
		if (existsSync(join(path, "index.html"))) {
			return path;
		}
	}

	return Array.from(candidates)[0] ?? join(process.cwd(), "dist", "ui");
}

export function serveStatic(app: Express): void {
	const uiDistPath = resolveUiDistPath();

	if (!existsSync(uiDistPath)) {
		logger.warning(`UI dist not found at ${uiDistPath}. Run 'bun run ui:build' first.`);
		// Use middleware instead of catch-all route for Express 5 compatibility
		app.use((req: Request, res: Response, next: NextFunction) => {
			if (req.path.startsWith("/api/")) {
				return next();
			}
			res.status(503).json({
				error: "Dashboard not built",
				message: "Run 'bun run ui:build' to build the dashboard",
			});
		});
		return;
	}

	// Serve static files with proper MIME types
	// Allow dotfiles in path (e.g., ~/.bun/install/...) for global installs
	app.use(
		express.static(uiDistPath, {
			dotfiles: "allow",
			setHeaders: (res, filePath) => {
				if (filePath.endsWith(".js")) {
					res.setHeader("Content-Type", "application/javascript");
				} else if (filePath.endsWith(".css")) {
					res.setHeader("Content-Type", "text/css");
				} else if (filePath.endsWith(".html")) {
					res.setHeader("Content-Type", "text/html");
				}
			},
		}),
	);

	// SPA fallback - serve index.html for non-API/asset routes
	app.use((req: Request, res: Response, next: NextFunction) => {
		// Skip API and WebSocket routes
		if (req.path.startsWith("/api/") || req.path.startsWith("/ws")) {
			return next();
		}
		// Skip asset files (let 404 happen if file not found)
		if (req.path.startsWith("/assets/") || req.path.match(/\.(js|css|ico|png|jpg|svg|woff2?)$/)) {
			return next();
		}
		// Allow dotfiles in path (e.g., ~/.bun/install/...) for global installs
		res.sendFile(join(uiDistPath, "index.html"), { dotfiles: "allow" });
	});

	logger.debug(`Serving static files from ${uiDistPath}`);
}
