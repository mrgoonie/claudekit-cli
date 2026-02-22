/**
 * Static file server for production UI
 * Supports embedded files (compiled binary) and filesystem (npm install)
 */

import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@/shared/logger.js";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIME_FALLBACK: Record<string, string> = {
	".html": "text/html",
	".js": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".woff": "font/woff",
};

/**
 * Try serving UI from Bun.embeddedFiles (compiled binary mode).
 * Returns true if embedded files are available and middleware was registered.
 */
export function tryServeFromEmbedded(app: Express): boolean {
	// Guard: only available in compiled Bun binaries
	if (typeof globalThis.Bun === "undefined" || !globalThis.Bun.embeddedFiles?.length) {
		return false;
	}

	// Detect path prefix by finding index.html (e.g. "dist/ui/index.html" → prefix "dist/ui/")
	let prefix = "";
	for (const blob of globalThis.Bun.embeddedFiles) {
		const name = (blob as Blob & { name: string }).name;
		if (name === "index.html" || name.endsWith("/index.html")) {
			prefix = name.replace("index.html", "");
			break;
		}
	}

	// Build lookup map: stripped path → Blob
	const fileMap = new Map<string, Blob>();
	let indexBlob: Blob | null = null;

	for (const blob of globalThis.Bun.embeddedFiles) {
		const rawName = (blob as Blob & { name: string }).name;
		const name = prefix && rawName.startsWith(prefix) ? rawName.slice(prefix.length) : rawName;
		fileMap.set(name, blob);
		if (name === "index.html") {
			indexBlob = blob;
		}
	}

	// No index.html in embedded files — can't serve UI
	if (!indexBlob) {
		logger.debug("Embedded files found but no index.html — skipping embedded serving");
		return false;
	}

	logger.debug(`Serving UI from ${fileMap.size} embedded files`);

	app.use(async (req: Request, res: Response, next: NextFunction) => {
		// Skip API and WebSocket routes
		if (req.path.startsWith("/api/") || req.path === "/ws" || req.path.startsWith("/ws/")) {
			return next();
		}

		// Guard against path traversal
		const reqPath = req.path.replace(/^\//, "");
		if (reqPath.includes("..") || reqPath.includes("\0")) {
			return next();
		}

		// Try exact match
		const blob = fileMap.get(reqPath);
		if (blob) {
			const ext = extname(reqPath);
			const contentType = blob.type || MIME_FALLBACK[ext] || "application/octet-stream";
			res.setHeader("Content-Type", contentType);
			// HTML: no-cache (binary updates need fresh index.html). Hashed assets: immutable.
			const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable";
			res.setHeader("Cache-Control", cacheControl);
			res.send(Buffer.from(await blob.arrayBuffer()));
			return;
		}

		// SPA fallback: non-asset routes serve index.html
		const hasExt = req.path.match(/\.(js|css|ico|png|jpg|svg|woff2?)$/);
		if (!hasExt && indexBlob) {
			const contentType = indexBlob.type || "text/html";
			res.setHeader("Content-Type", contentType);
			res.setHeader("Cache-Control", "no-cache");
			res.send(Buffer.from(await indexBlob.arrayBuffer()));
			return;
		}

		// Unmatched asset route — 404
		return next();
	});

	return true;
}

function resolveUiDistPath(): string {
	// Try multiple paths to support both dev and production modes
	const candidates = [
		// Production (npm install -g): dist/index.js → dist/ui/ (same directory)
		join(__dirname, "ui"),
		// Dev mode: running from CLI repo root
		join(process.cwd(), "dist", "ui"),
		// Dev mode alternative: src/ui/dist (if built there)
		join(process.cwd(), "src", "ui", "dist"),
	];

	for (const path of candidates) {
		// Check if index.html exists to confirm it's a valid built UI
		if (existsSync(join(path, "index.html"))) {
			return path;
		}
	}

	return candidates[0]; // Return first candidate for error message
}

export function serveStatic(app: Express): void {
	// Try embedded files first (compiled binary mode)
	if (tryServeFromEmbedded(app)) {
		return;
	}

	// Fallback: serve from filesystem (npm install / dev mode)
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
