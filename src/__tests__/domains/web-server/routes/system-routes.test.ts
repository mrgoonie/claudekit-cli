import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigVersionChecker } from "@/domains/sync/config-version-checker.js";
import { registerSystemRoutes } from "@/domains/web-server/routes/system-routes.js";
import express, { type Express } from "express";

interface TestServer {
	server: ReturnType<Express["listen"]>;
	baseUrl: string;
	testHome: string;
}

async function setupServer(): Promise<TestServer> {
	const testHome = await mkdtemp(join(tmpdir(), "ck-system-routes-"));
	process.env.CK_TEST_HOME = testHome;

	const app = express();
	app.use(express.json());
	registerSystemRoutes(app);

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
	process.env.CK_TEST_HOME = undefined;
	await rm(ctx.testHome, { recursive: true, force: true });
}

describe("system routes", () => {
	let ctx: TestServer;
	let checkForUpdatesSpy: ReturnType<
		typeof spyOn<typeof ConfigVersionChecker, "checkForUpdates">
	> | null;

	beforeEach(async () => {
		ctx = await setupServer();
		checkForUpdatesSpy = spyOn(ConfigVersionChecker, "checkForUpdates").mockResolvedValue({
			hasUpdates: false,
			currentVersion: "0.0.0",
			latestVersion: "0.0.0",
			fromCache: true,
		});
	});

	afterEach(async () => {
		checkForUpdatesSpy?.mockRestore();
		await teardownServer(ctx);
	});

	it("falls back to 0.0.0 when a multi-kit metadata entry exists without a version", async () => {
		const globalClaudeDir = join(ctx.testHome, ".claude");
		await mkdir(globalClaudeDir, { recursive: true });
		await writeFile(
			join(globalClaudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						installedAt: "2026-04-10T12:00:00.000Z",
						files: [],
					},
				},
			}),
		);

		const response = await fetch(
			`${ctx.baseUrl}/api/system/check-updates?target=kit&kit=engineer&channel=beta`,
		);

		expect(response.status).toBe(200);
		expect(checkForUpdatesSpy).toHaveBeenCalledWith("engineer", "0.0.0", true, "beta");

		const body = (await response.json()) as {
			current: string;
			latest: string | null;
			updateAvailable: boolean;
		};
		expect(body.current).toBe("0.0.0");
		expect(body.latest).toBe("0.0.0");
		expect(body.updateAvailable).toBe(false);
	});

	it("auto-detects beta channel from installed kit version when channel query is omitted", async () => {
		const globalClaudeDir = join(ctx.testHome, ".claude");
		await mkdir(globalClaudeDir, { recursive: true });
		await writeFile(
			join(globalClaudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.16.0-beta.9",
						installedAt: "2026-04-10T12:00:00.000Z",
						files: [],
					},
				},
			}),
		);

		const response = await fetch(`${ctx.baseUrl}/api/system/check-updates?target=kit&kit=engineer`);

		expect(response.status).toBe(200);
		expect(checkForUpdatesSpy).toHaveBeenCalledWith("engineer", "2.16.0-beta.9", true, "beta");
	});
});
