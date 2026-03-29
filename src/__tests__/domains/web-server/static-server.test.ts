import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveUiDistPath, tryServeFromEmbedded } from "@/domains/web-server/static-server.js";
import express from "express";

function createMockBlob(name: string, content: string, type: string): Blob & { name: string } {
	const blob = new Blob([content], { type }) as Blob & { name: string };
	Object.defineProperty(blob, "name", { value: name, writable: false });
	return blob;
}

// Save and restore embeddedFiles between tests
const originalEmbeddedFiles = globalThis.Bun.embeddedFiles;
const originalArgv1 = process.argv[1];
const originalExecPathDescriptor = Object.getOwnPropertyDescriptor(process, "execPath");

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

		test("serves JS asset with correct content-type and immutable cache", async () => {
			const res = await fetch(`${baseUrl}/assets/index-BdF3x9kL.js`);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("javascript");
			expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
			const text = await res.text();
			expect(text).toContain("console.log");
		});

		test("serves CSS asset with correct content-type", async () => {
			const res = await fetch(`${baseUrl}/assets/index-A1b2c3.css`);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("css");
			expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
		});

		test("SPA fallback serves index.html with no-cache", async () => {
			const res = await fetch(`${baseUrl}/settings`);
			expect(res.status).toBe(200);
			expect(res.headers.get("cache-control")).toBe("no-cache");
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

	describe("with prefixed blob names (real binary layout)", () => {
		let server: ReturnType<ReturnType<typeof express>["listen"]>;
		let baseUrl: string;

		beforeAll(() => {
			// Real compiled binaries produce blobs with directory prefix like "dist/ui/"
			// @ts-expect-error -- test override
			globalThis.Bun.embeddedFiles = [
				createMockBlob("dist/ui/index.html", "<html><body>Prefixed</body></html>", "text/html"),
				createMockBlob(
					"dist/ui/assets/app-BdF3x9kL.js",
					"console.log('prefixed')",
					"application/javascript",
				),
			];

			const app = express();
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

		test("strips prefix and serves index.html", async () => {
			const res = await fetch(`${baseUrl}/`);
			expect(res.status).toBe(200);
			const text = await res.text();
			expect(text).toContain("Prefixed");
		});

		test("strips prefix and serves assets", async () => {
			const res = await fetch(`${baseUrl}/assets/app-BdF3x9kL.js`);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("javascript");
			const text = await res.text();
			expect(text).toContain("prefixed");
		});
	});
});

describe("resolveUiDistPath", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		process.argv[1] = originalArgv1;
		if (originalExecPathDescriptor) {
			Object.defineProperty(process, "execPath", originalExecPathDescriptor);
		}
		for (const dir of tempDirs) {
			rmSync(dir, { force: true, recursive: true });
		}
		tempDirs.length = 0;
	});

	function createPackagedUiLayout(): string {
		const packageRoot = mkdtempSync(join(tmpdir(), "ck-static-ui-"));
		tempDirs.push(packageRoot);
		mkdirSync(join(packageRoot, "bin"), { recursive: true });
		mkdirSync(join(packageRoot, "dist", "ui"), { recursive: true });
		writeFileSync(join(packageRoot, "dist", "ui", "index.html"), "<html>dashboard</html>");
		return packageRoot;
	}

	test("resolves dist/ui relative to the compiled binary path", () => {
		const packageRoot = createPackagedUiLayout();
		Object.defineProperty(process, "execPath", {
			configurable: true,
			value: join(packageRoot, "bin", "ck-darwin-arm64"),
		});
		process.argv[1] = "config";

		expect(resolveUiDistPath()).toBe(join(packageRoot, "dist", "ui"));
	});

	test("resolves dist/ui relative to the invoked dist entrypoint", () => {
		const packageRoot = createPackagedUiLayout();
		Object.defineProperty(process, "execPath", {
			configurable: true,
			value: "/usr/local/bin/bun",
		});
		process.argv[1] = join(packageRoot, "dist", "index.js");

		expect(resolveUiDistPath()).toBe(join(packageRoot, "dist", "ui"));
	});
});
