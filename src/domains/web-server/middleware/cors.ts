/**
 * Origin validation middleware for the dashboard API.
 */

import type { NextFunction, Request, Response } from "express";

const LOCAL_DEV_ORIGINS = new Set(
	["localhost", "127.0.0.1", "[::1]"].flatMap((host) => [
		`http://${host}:3000`,
		`http://${host}:3456`,
		`http://${host}:5173`,
	]),
);

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
	const origin = getHeaderValue(req.headers.origin);
	const normalizedOrigin = origin ? normalizeOrigin(origin) : null;

	// CSRF protection: reject requests whose Origin does not match the active request host
	if (origin && (!normalizedOrigin || !isAllowedOrigin(normalizedOrigin, req))) {
		res.status(403).json({ error: "Forbidden: invalid origin" });
		return;
	}

	if (normalizedOrigin) {
		appendVaryHeader(res, "Origin");
		res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
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

export function isAllowedOrigin(origin: string, req: Request): boolean {
	if (LOCAL_DEV_ORIGINS.has(origin)) {
		return true;
	}

	return getRequestOrigins(req).has(origin);
}

export function getRequestOrigins(req: Request): Set<string> {
	const origins = new Set<string>();
	const hosts = getHeaderValues(req.headers["x-forwarded-host"]).concat(
		getHeaderValues(req.headers.host),
	);
	const protocols = getForwardedProtocols(req);

	for (const host of hosts) {
		for (const protocol of protocols) {
			origins.add(`${protocol}://${host}`);
		}
	}

	return origins;
}

function getForwardedProtocols(req: Request): string[] {
	const forwarded = getHeaderValues(req.headers["x-forwarded-proto"]).map((value) =>
		value.toLowerCase(),
	);
	const current =
		typeof req.protocol === "string" && req.protocol ? [req.protocol.toLowerCase()] : ["http"];

	return Array.from(
		new Set([...forwarded, ...current].filter((value) => value === "http" || value === "https")),
	);
}

function normalizeOrigin(origin: string): string | null {
	try {
		return new URL(origin).origin;
	} catch {
		return null;
	}
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}

function getHeaderValues(value: string | string[] | undefined): string[] {
	const raw = Array.isArray(value) ? value.join(",") : value;
	if (!raw) {
		return [];
	}

	return raw
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function appendVaryHeader(res: Response, value: string): void {
	const current = res.getHeader("Vary");
	if (!current) {
		res.setHeader("Vary", value);
		return;
	}

	const entries = String(current)
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);

	if (!entries.includes(value)) {
		entries.push(value);
		res.setHeader("Vary", entries.join(", "));
	}
}
