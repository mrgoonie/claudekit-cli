import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	DASHBOARD_FEATURES,
	registerHealthRoutes,
} from "@/domains/web-server/routes/health-routes.js";
import express, { type Express } from "express";

interface TestServer {
	server: ReturnType<Express["listen"]>;
	baseUrl: string;
}

async function setupServer(): Promise<TestServer> {
	const app = express();
	registerHealthRoutes(app);

	const server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Failed to start test server");
	}

	return {
		server,
		baseUrl: `http://127.0.0.1:${address.port}`,
	};
}

async function teardownServer(ctx: TestServer): Promise<void> {
	await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
}

describe("GET /api/health", () => {
	let ctx: TestServer;

	beforeEach(async () => {
		ctx = await setupServer();
	});

	afterEach(async () => {
		await teardownServer(ctx);
	});

	it("returns status ok with correct shape", async () => {
		const res = await fetch(`${ctx.baseUrl}/api/health`);

		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			status: string;
			timestamp: string;
			uptime: number;
			features: string[];
		};

		expect(body.status).toBe("ok");
		expect(typeof body.timestamp).toBe("string");
		expect(typeof body.uptime).toBe("number");
		expect(Array.isArray(body.features)).toBe(true);
	});

	it("features array is non-empty and includes plans-dashboard", async () => {
		const res = await fetch(`${ctx.baseUrl}/api/health`);
		const body = (await res.json()) as { features: string[] };

		expect(body.features.length).toBeGreaterThan(0);
		expect(body.features).toContain("plans-dashboard");
	});

	it("features array matches DASHBOARD_FEATURES constant", async () => {
		const res = await fetch(`${ctx.baseUrl}/api/health`);
		const body = (await res.json()) as { features: string[] };

		expect(body.features).toEqual([...DASHBOARD_FEATURES]);
	});
});
