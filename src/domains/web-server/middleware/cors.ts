/**
 * CORS middleware for local development
 */

import type { NextFunction, Request, Response } from "express";

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
	// CSRF protection: reject requests with invalid origin header
	const origin = req.headers.origin;
	if (origin && !origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
		res.status(403).json({ error: "Forbidden: invalid origin" });
		return;
	}

	// Allow local development origins
	const allowedOrigins = [
		"http://localhost:3000",
		"http://localhost:3456",
		"http://localhost:5173", // Vite default
		"http://127.0.0.1:3000",
		"http://127.0.0.1:3456",
		"http://127.0.0.1:5173",
	];

	if (origin && allowedOrigins.includes(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
	}

	res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
	res.setHeader("Access-Control-Allow-Credentials", "true");

	if (req.method === "OPTIONS") {
		res.sendStatus(204);
		return;
	}

	next();
}
