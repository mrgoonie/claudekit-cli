import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectsRegistryManager } from "@/domains/claudekit-data/projects-registry.js";
import { registerActionRoutes } from "@/domains/web-server/routes/action-routes.js";
import express, { type Express } from "express";

interface TestServer {
	server: ReturnType<Express["listen"]>;
	baseUrl: string;
	testHome: string;
}

async function setupServer(): Promise<TestServer> {
	const testHome = await mkdtemp(join(tmpdir(), "ck-action-routes-"));
	process.env.CK_TEST_HOME = testHome;
	ProjectsRegistryManager.clearCache();

	const app = express();
	app.use(express.json());
	registerActionRoutes(app);

	const server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Failed to start test server");
	}

	return {
		server,
		baseUrl: `http://127.0.0.1:${address.port}`,
		testHome,
	};
}

async function teardownServer(ctx: TestServer): Promise<void> {
	await new Promise<void>((resolveClose) => ctx.server.close(() => resolveClose()));
	await rm(ctx.testHome, { recursive: true, force: true });
	ProjectsRegistryManager.clearCache();
}

describe("action routes validation", () => {
	let ctx: TestServer;

	beforeEach(async () => {
		ctx = await setupServer();
	});

	afterEach(async () => {
		await teardownServer(ctx);
	});

	test("rejects invalid open request body", async () => {
		const res = await fetch(`${ctx.baseUrl}/api/actions/open`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "terminal" }),
		});

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Invalid request body");
	});

	test("rejects invalid options query", async () => {
		const invalidProjectId = "a".repeat(300);
		const res = await fetch(`${ctx.baseUrl}/api/actions/options?projectId=${invalidProjectId}`);

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Invalid request query");
	});

	test("rejects unregistered path when project id is unknown", async () => {
		const sandboxPath = join(ctx.testHome, "outside-registry");
		await mkdir(sandboxPath, { recursive: true });

		const res = await fetch(`${ctx.baseUrl}/api/actions/open`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "terminal",
				path: sandboxPath,
				projectId: "missing-project-id",
			}),
		});

		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("Path is not allowed");
	});

	test("rejects invalid app id before spawn", async () => {
		const projectPath = join(ctx.testHome, "allowed-project");
		await mkdir(projectPath, { recursive: true });
		const project = await ProjectsRegistryManager.addProject(projectPath, {
			alias: "allowed-project",
		});

		const res = await fetch(`${ctx.baseUrl}/api/actions/open`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "terminal",
				path: projectPath,
				projectId: project.id,
				appId: "not-a-valid-app-id",
			}),
		});

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("Invalid terminal appId");
	});
});
