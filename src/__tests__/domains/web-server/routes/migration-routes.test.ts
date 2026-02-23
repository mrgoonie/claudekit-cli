import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express, { type Express } from "express";

const actualAgentDiscovery = await import("@/commands/agents/agents-discovery.js");
const actualCommandDiscovery = await import("@/commands/commands/commands-discovery.js");
const actualConfigDiscovery = await import("@/commands/portable/config-discovery.js");
const actualPortableInstaller = await import("@/commands/portable/portable-installer.js");
const actualPortableRegistry = await import("@/commands/portable/portable-registry.js");
const actualSkillDirectoryInstaller = await import(
	"@/commands/migrate/skill-directory-installer.js"
);
const actualSkillDiscovery = await import("@/commands/skills/skills-discovery.js");

type PortableRegistryResult = Awaited<
	ReturnType<typeof actualPortableRegistry.readPortableRegistry>
>;
type SkillDiscoveryResult = Awaited<ReturnType<typeof actualSkillDiscovery.discoverSkills>>;

const discoverAgentsMock = mock(async () => []);
const getAgentSourcePathMock = mock(() => null);
mock.module("@/commands/agents/agents-discovery.js", () => ({
	...actualAgentDiscovery,
	discoverAgents: discoverAgentsMock,
	getAgentSourcePath: getAgentSourcePathMock,
}));

const discoverCommandsMock = mock(async () => []);
const getCommandSourcePathMock = mock(() => null);
mock.module("@/commands/commands/commands-discovery.js", () => ({
	...actualCommandDiscovery,
	discoverCommands: discoverCommandsMock,
	getCommandSourcePath: getCommandSourcePathMock,
}));

const discoverSkillsMock = mock(async (): Promise<SkillDiscoveryResult> => []);
const getSkillSourcePathMock = mock((): string | null => null);
mock.module("@/commands/skills/skills-discovery.js", () => ({
	...actualSkillDiscovery,
	discoverSkills: discoverSkillsMock,
	getSkillSourcePath: getSkillSourcePathMock,
}));

const discoverConfigMock = mock(async () => null);
const discoverRulesMock = mock(async () => []);
mock.module("@/commands/portable/config-discovery.js", () => ({
	...actualConfigDiscovery,
	discoverConfig: discoverConfigMock,
	discoverRules: discoverRulesMock,
}));

const installPortableItemsMock = mock(
	async (_items: unknown[], _providers: unknown[], _type: unknown) => [],
);
mock.module("@/commands/portable/portable-installer.js", () => ({
	...actualPortableInstaller,
	installPortableItems: installPortableItemsMock,
}));

const installSkillDirectoriesMock = mock(
	async (skills: Array<{ name: string }>, providers: string[]) => {
		return providers.flatMap((provider) =>
			skills.map((skill) => ({
				provider,
				providerDisplayName: provider,
				success: true,
				path: `/tmp/${provider}/${skill.name}`,
			})),
		);
	},
);
mock.module("@/commands/migrate/skill-directory-installer.js", () => ({
	...actualSkillDirectoryInstaller,
	installSkillDirectories: installSkillDirectoriesMock,
}));

const readPortableRegistryMock = mock(
	async (): Promise<PortableRegistryResult> => ({
		version: "3.0",
		installations: [],
	}),
);
mock.module("@/commands/portable/portable-registry.js", () => ({
	...actualPortableRegistry,
	readPortableRegistry: readPortableRegistryMock,
}));

const { registerMigrationRoutes } = await import("@/domains/web-server/routes/migration-routes.js");

interface TestServer {
	server: ReturnType<Express["listen"]>;
	baseUrl: string;
	testHome: string;
}

function makeRegistryWithInstallation(
	installation: PortableRegistryResult["installations"][number],
): PortableRegistryResult {
	return {
		version: "3.0",
		installations: [installation],
	};
}

function makeInstallation(path: string, type: "skill" | "command") {
	return {
		item: type === "skill" ? "agent-browser" : "bad-command",
		type,
		provider: "codex",
		global: true,
		path,
		installedAt: new Date().toISOString(),
		sourcePath: path,
		sourceChecksum: "source-checksum",
		targetChecksum: "target-checksum",
		installSource: "kit" as const,
	};
}

async function setupServer(): Promise<TestServer> {
	const testHome = await mkdtemp(join(tmpdir(), "ck-migration-routes-"));

	const app = express();
	app.use(express.json());
	registerMigrationRoutes(app);

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
}

describe("migration reconcile route", () => {
	let ctx: TestServer;

	beforeEach(async () => {
		ctx = await setupServer();
		discoverAgentsMock.mockReset();
		discoverAgentsMock.mockResolvedValue([]);
		discoverCommandsMock.mockReset();
		discoverCommandsMock.mockResolvedValue([]);
		discoverSkillsMock.mockReset();
		discoverSkillsMock.mockResolvedValue([]);
		discoverConfigMock.mockReset();
		discoverConfigMock.mockResolvedValue(null);
		discoverRulesMock.mockReset();
		discoverRulesMock.mockResolvedValue([]);
		installPortableItemsMock.mockReset();
		installPortableItemsMock.mockResolvedValue([]);
		installSkillDirectoriesMock.mockReset();
		installSkillDirectoriesMock.mockResolvedValue([]);
		readPortableRegistryMock.mockReset();
		readPortableRegistryMock.mockResolvedValue({
			version: "3.0",
			installations: [],
		});
	});

	afterEach(async () => {
		await teardownServer(ctx);
	});

	afterAll(() => {
		mock.restore();
	});

	test("returns 200 when registry contains skill directory entries", async () => {
		const skillDir = join(ctx.testHome, "skills", "agent-browser");
		await mkdir(skillDir, { recursive: true });

		readPortableRegistryMock.mockResolvedValueOnce(
			makeRegistryWithInstallation(makeInstallation(skillDir, "skill")),
		);

		const res = await fetch(`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=true`);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { plan: { actions: unknown[] } };
		expect(Array.isArray(body.plan.actions)).toBe(true);
	});

	test("returns 200 when non-skill registry path exists but is unreadable as a file", async () => {
		const commandDir = join(ctx.testHome, "commands", "not-a-file");
		await mkdir(commandDir, { recursive: true });

		readPortableRegistryMock.mockResolvedValueOnce(
			makeRegistryWithInstallation(makeInstallation(commandDir, "command")),
		);

		const res = await fetch(`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=true`);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { plan: { actions: unknown[] } };
		expect(Array.isArray(body.plan.actions)).toBe(true);
	});

	test("accepts JSON conflict key format for plan execution", async () => {
		const plan = {
			actions: [
				{
					action: "conflict",
					item: "my:item",
					type: "config",
					provider: "codex",
					global: true,
					targetPath: "/tmp/config.md",
					reason: "Conflict",
				},
			],
			summary: { install: 0, update: 0, skip: 0, conflict: 1, delete: 0 },
			hasConflicts: true,
			meta: {
				include: { agents: false, commands: false, skills: false, config: true, rules: false },
				providers: ["codex"],
			},
		};

		const key = JSON.stringify(["codex", "config", "my:item", true]);
		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plan,
				resolutions: {
					[key]: { type: "overwrite" },
				},
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			counts: { installed: number; skipped: number; failed: number };
		};
		expect(body.counts.skipped).toBeGreaterThanOrEqual(1);
	});

	test("skills fallback installs only skills listed in plan meta", async () => {
		getSkillSourcePathMock.mockReturnValueOnce("/tmp/skills");
		discoverSkillsMock.mockResolvedValueOnce([
			{
				name: "skill-a",
				displayName: "Skill A",
				description: "",
				version: "1.0.0",
				license: "MIT",
				path: "/tmp/skill-a",
			},
			{
				name: "skill-b",
				displayName: "Skill B",
				description: "",
				version: "1.0.0",
				license: "MIT",
				path: "/tmp/skill-b",
			},
		]);

		installSkillDirectoriesMock.mockImplementationOnce(async (skills, providers) =>
			providers.flatMap((provider) =>
				skills.map((skill) => ({
					provider,
					providerDisplayName: provider,
					success: true,
					path: `/tmp/${provider}/${skill.name}`,
				})),
			),
		);

		const plan = {
			actions: [],
			summary: { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 },
			hasConflicts: false,
			meta: {
				include: { agents: false, commands: false, skills: true, config: false, rules: false },
				providers: ["codex"],
				items: { skills: ["skill-a"] },
			},
		};

		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan, resolutions: {} }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			results: Array<{ itemName?: string }>;
			discovery: { skills: number };
		};
		expect(installSkillDirectoriesMock).toHaveBeenCalledTimes(1);
		expect(installSkillDirectoriesMock.mock.calls[0]?.[0]?.[0]?.name).toBe("skill-a");
		expect(body.results.every((entry) => entry.itemName !== "skill-b")).toBe(true);
		expect(body.discovery.skills).toBe(1);
	});
});
