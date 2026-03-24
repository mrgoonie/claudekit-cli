import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	ProjectsRegistryManager,
	clearDiscoveredProjectsCache,
} from "@/domains/claudekit-data/index.js";
import { registerHookLogRoutes } from "@/domains/web-server/routes/hook-log-routes.js";
import { PathResolver } from "@/shared/path-resolver.js";
import express, { type Express } from "express";

const TEST_HOME = join(tmpdir(), `ck-hook-route-test-${Date.now()}-${process.pid}`);
process.env.CK_TEST_HOME = TEST_HOME;

let baseUrl = "";
let server: ReturnType<Express["listen"]>;

async function writeHookLog(filePath: string, lines: string[]): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

beforeAll(() => {
	const app = express();
	registerHookLogRoutes(app);
	server = app.listen(0);
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Failed to start hook log test server");
	}
	baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
	ProjectsRegistryManager.clearCache();
	clearDiscoveredProjectsCache();
	await rm(TEST_HOME, { recursive: true, force: true });
	await mkdir(TEST_HOME, { recursive: true });
});

afterAll(async () => {
	server.close();
	ProjectsRegistryManager.clearCache();
	clearDiscoveredProjectsCache();
	await rm(TEST_HOME, { recursive: true, force: true });
	Reflect.deleteProperty(process.env, "CK_TEST_HOME");
});

describe("GET /api/system/hook-diagnostics", () => {
	test("returns global hook diagnostics", async () => {
		const logPath = join(PathResolver.getGlobalKitDir(), "hooks", ".logs", "hook-log.jsonl");
		await writeHookLog(logPath, [
			JSON.stringify({
				ts: "2026-03-18T12:00:00.000Z",
				hook: "scout-block",
				event: "PreToolUse",
				tool: "Read",
				status: "ok",
			}),
		]);

		const response = await fetch(`${baseUrl}/api/system/hook-diagnostics?scope=global&limit=10`);
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			exists: boolean;
			path: string;
			entries: Array<{ hook: string }>;
			summary: { total: number };
		};

		expect(body.exists).toBe(true);
		expect(body.path).toBe(logPath);
		expect(body.entries[0]?.hook).toBe("scout-block");
		expect(body.summary.total).toBe(1);
	});

	test("defaults to global scope when scope is omitted", async () => {
		const logPath = join(PathResolver.getGlobalKitDir(), "hooks", ".logs", "hook-log.jsonl");
		await writeHookLog(logPath, [
			JSON.stringify({
				ts: "2026-03-18T12:10:00.000Z",
				hook: "usage-context-awareness",
				status: "warn",
			}),
		]);

		const response = await fetch(`${baseUrl}/api/system/hook-diagnostics`);
		expect(response.status).toBe(200);

		const body = (await response.json()) as { scope: string; path: string };
		expect(body.scope).toBe("global");
		expect(body.path).toBe(logPath);
	});

	test("returns 400 when project scope omits projectId", async () => {
		const response = await fetch(`${baseUrl}/api/system/hook-diagnostics?scope=project`);
		expect(response.status).toBe(400);
	});

	test("returns 400 for invalid scopes", async () => {
		const response = await fetch(`${baseUrl}/api/system/hook-diagnostics?scope=invalid`);
		expect(response.status).toBe(400);
	});

	test("returns 404 for unknown project ids", async () => {
		const response = await fetch(
			`${baseUrl}/api/system/hook-diagnostics?scope=project&projectId=missing-project`,
		);
		expect(response.status).toBe(404);
	});

	test("returns 404 for undocumented projectId=current requests", async () => {
		const response = await fetch(
			`${baseUrl}/api/system/hook-diagnostics?scope=project&projectId=current`,
		);
		expect(response.status).toBe(404);
	});

	test("returns 400 when projectId exceeds the accepted length", async () => {
		const response = await fetch(
			`${baseUrl}/api/system/hook-diagnostics?scope=project&projectId=${"a".repeat(513)}`,
		);
		expect(response.status).toBe(400);
	});

	test("returns 404 for forged discovered project ids", async () => {
		const projectDir = join(TEST_HOME, "forged-project");
		const logPath = join(projectDir, ".claude", "hooks", ".logs", "hook-log.jsonl");
		const forgedId = `discovered-${Buffer.from(projectDir).toString("base64url")}`;

		await mkdir(projectDir, { recursive: true });
		await writeHookLog(logPath, [
			JSON.stringify({
				ts: "2026-03-18T13:00:00.000Z",
				hook: "privacy-block",
				status: "block",
			}),
		]);

		const response = await fetch(
			`${baseUrl}/api/system/hook-diagnostics?scope=project&projectId=${encodeURIComponent(forgedId)}`,
		);
		expect(response.status).toBe(404);
	});

	test("maps projectId=global to the global diagnostics log", async () => {
		const logPath = join(PathResolver.getGlobalKitDir(), "hooks", ".logs", "hook-log.jsonl");
		await writeHookLog(logPath, [
			JSON.stringify({
				ts: "2026-03-18T12:00:00.000Z",
				hook: "usage-context-awareness",
				status: "warn",
			}),
		]);

		const response = await fetch(
			`${baseUrl}/api/system/hook-diagnostics?scope=project&projectId=global`,
		);
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			scope: string;
			path: string;
			exists: boolean;
		};

		expect(body.scope).toBe("global");
		expect(body.path).toBe(logPath);
		expect(body.exists).toBe(true);
	});
});
