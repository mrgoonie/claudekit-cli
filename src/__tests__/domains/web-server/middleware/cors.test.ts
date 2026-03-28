import { describe, expect, test } from "bun:test";
import {
	corsMiddleware,
	getRequestOrigins,
	isAllowedOrigin,
} from "@/domains/web-server/middleware/cors.js";
import type { Request, Response } from "express";

type MockResponse = {
	headers: Map<string, string>;
	jsonBody: unknown;
	sendStatusCode: number | null;
	statusCode: number | null;
	getHeader(name: string): string | undefined;
	json(body: unknown): MockResponse;
	sendStatus(code: number): MockResponse;
	setHeader(name: string, value: string): MockResponse;
	status(code: number): MockResponse;
};

function createRequest({
	host,
	origin,
	method = "GET",
	forwardedHost,
	forwardedProto,
	protocol = "http",
}: {
	host?: string;
	origin?: string;
	method?: string;
	forwardedHost?: string;
	forwardedProto?: string;
	protocol?: string;
}): Request {
	return {
		headers: {
			host,
			origin,
			"x-forwarded-host": forwardedHost,
			"x-forwarded-proto": forwardedProto,
		},
		method,
		protocol,
	} as unknown as Request;
}

function createResponse(): MockResponse {
	const headers = new Map<string, string>();

	return {
		headers,
		jsonBody: null,
		sendStatusCode: null,
		statusCode: null,
		getHeader(name: string): string | undefined {
			return headers.get(name);
		},
		json(body: unknown): MockResponse {
			this.jsonBody = body;
			return this;
		},
		sendStatus(code: number): MockResponse {
			this.sendStatusCode = code;
			return this;
		},
		setHeader(name: string, value: string): MockResponse {
			headers.set(name, value);
			return this;
		},
		status(code: number): MockResponse {
			this.statusCode = code;
			return this;
		},
	};
}

describe("corsMiddleware", () => {
	test("allows same-origin remote requests without a localhost allowlist", () => {
		const req = createRequest({
			host: "100.88.12.4:3456",
			origin: "http://100.88.12.4:3456",
		});
		const res = createResponse();
		let nextCalled = false;

		corsMiddleware(req, res as unknown as Response, () => {
			nextCalled = true;
		});

		expect(nextCalled).toBe(true);
		expect(res.getHeader("Access-Control-Allow-Origin")).toBe("http://100.88.12.4:3456");
		expect(res.statusCode).toBeNull();
	});

	test("allows proxied same-origin https requests when forwarded headers are present", () => {
		const req = createRequest({
			host: "127.0.0.1:3456",
			origin: "https://dashboard.example.com",
			forwardedHost: "dashboard.example.com",
			forwardedProto: "https",
		});

		expect(isAllowedOrigin("https://dashboard.example.com", req)).toBe(true);
		expect(getRequestOrigins(req)).toContain("https://dashboard.example.com");
	});

	test("allows local frontend development origins", () => {
		const req = createRequest({
			host: "localhost:3456",
			origin: "http://localhost:5173",
		});
		const res = createResponse();
		let nextCalled = false;

		corsMiddleware(req, res as unknown as Response, () => {
			nextCalled = true;
		});

		expect(nextCalled).toBe(true);
		expect(res.getHeader("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
	});

	test("rejects unrelated cross-origin requests", () => {
		const req = createRequest({
			host: "100.88.12.4:3456",
			origin: "https://evil.example.com",
		});
		const res = createResponse();
		let nextCalled = false;

		corsMiddleware(req, res as unknown as Response, () => {
			nextCalled = true;
		});

		expect(nextCalled).toBe(false);
		expect(res.statusCode).toBe(403);
		expect(res.jsonBody).toEqual({ error: "Forbidden: invalid origin" });
	});

	test("rejects malformed origin headers", () => {
		const req = createRequest({
			host: "localhost:3456",
			origin: "not-a-valid-origin",
		});
		const res = createResponse();

		corsMiddleware(req, res as unknown as Response, () => {});

		expect(res.statusCode).toBe(403);
	});

	test("returns 204 for valid preflight requests", () => {
		const req = createRequest({
			host: "100.88.12.4:3456",
			origin: "http://100.88.12.4:3456",
			method: "OPTIONS",
		});
		const res = createResponse();
		let nextCalled = false;

		corsMiddleware(req, res as unknown as Response, () => {
			nextCalled = true;
		});

		expect(res.sendStatusCode).toBe(204);
		expect(nextCalled).toBe(false);
	});
});
