import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tryServeFromEmbedded } from "@/domains/web-server/static-server.js";
import express from "express";

function createMockBlob(name: string, content: string, type: string): Blob & { name: string } {
	const blob = new Blob([content], { type }) as Blob & { name: string };
	Object.defineProperty(blob, "name", { value: name, writable: false });
	return blob;
}

// Save and restore embeddedFiles between tests
const originalEmbeddedFiles = globalThis.Bun.embeddedFiles;

describe("tryServeFromEmbedded", () => {
	afterAll(() => {
		// @ts-expect-error -- restoring original value
		globalThis.Bun.embeddedFiles = originalEmbeddedFiles;
	});

	test("returns false when embeddedFiles is empty", () => {
		// @ts-expect-error -- test override
		globalThis.Bun.embeddedFiles = [];
		const app = express();
		expect(tryServeFromEmbedded(app)).toBe(false);
	});

	test("returns false when no index.html in embedded files", () => {
		// @ts-expect-error -- test override
		globalThis.Bun.embeddedFiles = [
			createMockBlob("assets/app.js", "console.log('hi')", "application/javascript"),
		];
		const app = express();
		expect(tryServeFromEmbedded(app)).toBe(false);
	});

	describe("with embedded files serving", () => {
		let server: ReturnType<ReturnType<typeof express>["listen"]>;
		let baseUrl: string;

		beforeAll(() => {
			// @ts-expect-error -- test override
			globalThis.Bun.embeddedFiles = [
				createMockBlob("index.html", "<html><body>Dashboard</body></html>", "text/html"),
				createMockBlob("assets/index-BdF3x9kL.js", "console.log('app')", "application/javascript"),
				createMockBlob("assets/index-A1b2c3.css", "body{color:red}", "text/css"),
			];

			const app = express();
			// API route to verify passthrough
			app.get("/api/health", (_req, res) => res.json({ ok: true }));
			const result = tryServeFromEmbedded(app);
			expect(result).toBe(true);

			server = app.listen(0);
			const address = server.address();
			if (!address || typeof address === "string") throw new Error("Failed to start");
			baseUrl = `http://127.0.0.1:${(address as { port: number }).port}`;
		});

		afterAll(async () => {
			if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
			// @ts-expect-error -- restoring original value
			globalThis.Bun.embeddedFiles = originalEmbeddedFiles;
		});

		test("serves index.html for root path", async () => {
			const res = await fetch(`${baseUrl}/`);
			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toContain("Dashboard");
		});

		test("serves JS asset with correct content-type", async () => {
			const res = await fetch(`${baseUrl}/assets/index-BdF3x9kL.js`);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("javascript");
			const text = await res.text();
			expect(text).toContain("console.log");
		});

		test("serves CSS asset with correct content-type", async () => {
			const res = await fetch(`${baseUrl}/assets/index-A1b2c3.css`);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("css");
		});

		test("SPA fallback serves index.html for non-asset routes", async () => {
			const res = await fetch(`${baseUrl}/settings`);
			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toContain("Dashboard");
		});

		test("skips API routes (next())", async () => {
			const res = await fetch(`${baseUrl}/api/health`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json).toEqual({ ok: true });
		});

		test("returns 404 for unknown asset files", async () => {
			const res = await fetch(`${baseUrl}/assets/missing.js`);
			expect(res.status).toBe(404);
		});
	});
});
