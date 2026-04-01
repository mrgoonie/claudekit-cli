import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerCkConfigRoutes } from "@/domains/web-server/routes/ck-config-routes.js";
import express, { type Express } from "express";

let baseUrl = "";
let server: ReturnType<Express["listen"]>;
const tempDirs: string[] = [];

beforeAll(() => {
	const app = express();
	app.use(express.json());
	registerCkConfigRoutes(app);
	server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Failed to start ck-config route test server");
	}
	baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

afterAll(() => {
	server.close();
});

describe("PUT /api/ck-config", () => {
	test("returns the persisted project scope after partial saves", async () => {
		const projectDir = join(
			tmpdir(),
			`ck-config-route-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		tempDirs.push(projectDir);

		const configPath = join(projectDir, ".claude", ".ck.json");
		await mkdir(join(projectDir, ".claude"), { recursive: true });
		await writeFile(
			configPath,
			JSON.stringify(
				{
					gemini: {
						model: "gemini-3.0-flash",
						stale: true,
					},
					paths: {
						docs: "docs",
					},
				},
				null,
				2,
			),
		);

		const projectId = `discovered-${Buffer.from(projectDir).toString("base64url")}`;
		const response = await fetch(`${baseUrl}/api/ck-config`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				scope: "project",
				projectId,
				config: {
					statusline: "compact",
				},
			}),
		});

		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			path: string;
			scope: string;
			config: {
				gemini?: { model?: string; stale?: boolean };
				paths?: { docs?: string };
				statusline?: string;
			};
		};
		const savedConfig = JSON.parse(await readFile(configPath, "utf-8")) as typeof body.config;

		expect(body.path).toBe(configPath);
		expect(body.scope).toBe("project");
		expect(body.config).toEqual(savedConfig);
		expect(body.config.gemini?.model).toBe("gemini-3-flash-preview");
		expect(body.config.gemini?.stale).toBeUndefined();
		expect(body.config.paths?.docs).toBe("docs");
		expect(body.config.statusline).toBe("compact");
	});

	test("preserves and returns raw scope fields when the existing file no longer matches schema", async () => {
		const projectDir = join(
			tmpdir(),
			`ck-config-route-invalid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		tempDirs.push(projectDir);

		const configPath = join(projectDir, ".claude", ".ck.json");
		await mkdir(join(projectDir, ".claude"), { recursive: true });
		await writeFile(
			configPath,
			JSON.stringify({
				gemini: {
					model: "gemini-4-preview",
				},
				paths: {
					docs: "docs",
				},
			}),
		);

		const projectId = `discovered-${Buffer.from(projectDir).toString("base64url")}`;
		const response = await fetch(`${baseUrl}/api/ck-config`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				scope: "project",
				projectId,
				config: {
					statusline: "compact",
				},
			}),
		});

		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			config: {
				gemini?: { model?: string };
				paths?: { docs?: string };
				statusline?: string;
			};
		};
		const savedConfig = JSON.parse(await readFile(configPath, "utf-8")) as typeof body.config;

		expect(body.config).toEqual(savedConfig);
		expect(body.config.gemini?.model).toBe("gemini-4-preview");
		expect(body.config.paths?.docs).toBe("docs");
		expect(body.config.statusline).toBe("compact");
	});
});
