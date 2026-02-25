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
type AgentDiscoveryResult = Awaited<ReturnType<typeof actualAgentDiscovery.discoverAgents>>;
type CommandDiscoveryResult = Awaited<ReturnType<typeof actualCommandDiscovery.discoverCommands>>;
type SkillDiscoveryResult = Awaited<ReturnType<typeof actualSkillDiscovery.discoverSkills>>;
type PortableInstallBatch = Awaited<
	ReturnType<typeof actualPortableInstaller.installPortableItems>
>;

const discoverAgentsMock = mock(async (): Promise<AgentDiscoveryResult> => []);
const getAgentSourcePathMock = mock((): string | null => null);
mock.module("@/commands/agents/agents-discovery.js", () => ({
	...actualAgentDiscovery,
	discoverAgents: discoverAgentsMock,
	getAgentSourcePath: getAgentSourcePathMock,
}));

const discoverCommandsMock = mock(async (): Promise<CommandDiscoveryResult> => []);
const getCommandSourcePathMock = mock((): string | null => null);
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
const discoverHooksMock = mock(async () => []);
const getHooksSourcePathMock = mock((): string | null => null);
mock.module("@/commands/portable/config-discovery.js", () => ({
	...actualConfigDiscovery,
	discoverConfig: discoverConfigMock,
	discoverRules: discoverRulesMock,
	discoverHooks: discoverHooksMock,
	getHooksSourcePath: getHooksSourcePathMock,
}));

const installPortableItemsMock = mock(
	async (
		_items: unknown[],
		_providers: unknown[],
		_type: unknown,
	): Promise<PortableInstallBatch> => [],
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
const removePortableInstallationMock = mock(async () => undefined);
mock.module("@/commands/portable/portable-registry.js", () => ({
	...actualPortableRegistry,
	readPortableRegistry: readPortableRegistryMock,
	removePortableInstallation: removePortableInstallationMock,
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
	await new Promise<void>((resolveServer, rejectServer) => {
		server.once("listening", () => resolveServer());
		server.once("error", (error) => rejectServer(error));
	});
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
	let ctx!: TestServer;
	let hasCtx = false;

	beforeEach(async () => {
		ctx = await setupServer();
		hasCtx = true;
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
		discoverHooksMock.mockReset();
		discoverHooksMock.mockResolvedValue([]);
		getHooksSourcePathMock.mockReset();
		getHooksSourcePathMock.mockReturnValue(null);
		installPortableItemsMock.mockReset();
		installPortableItemsMock.mockResolvedValue([]);
		installSkillDirectoriesMock.mockReset();
		installSkillDirectoriesMock.mockResolvedValue([]);
		readPortableRegistryMock.mockReset();
		readPortableRegistryMock.mockResolvedValue({
			version: "3.0",
			installations: [],
		});
		removePortableInstallationMock.mockReset();
		removePortableInstallationMock.mockResolvedValue(undefined);
	});

	afterEach(async () => {
		if (hasCtx) {
			await teardownServer(ctx);
			hasCtx = false;
		}
	});

	afterAll(() => {
		mock.restore();
	});

	test("returns provider list including Droid as recommended", async () => {
		const res = await fetch(`${ctx.baseUrl}/api/migrate/providers`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			providers: Array<{
				name: string;
				recommended: boolean;
				capabilities: {
					agents: boolean;
					commands: boolean;
					skills: boolean;
					config: boolean;
					rules: boolean;
					hooks: boolean;
				};
			}>;
		};
		const droidProvider = body.providers.find((provider) => provider.name === "droid");
		expect(droidProvider).toBeDefined();
		expect(droidProvider?.recommended).toBe(true);
		expect(droidProvider?.capabilities).toEqual({
			agents: true,
			commands: true,
			skills: true,
			config: true,
			rules: true,
			hooks: true,
		});
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
				include: { agents: false, commands: false, skills: false, config: true, rules: false, hooks: false },
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
				include: { agents: false, commands: false, skills: true, config: false, rules: false, hooks: false },
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

	test("skills fallback installs discovered skills for legacy plan without include/items meta", async () => {
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

		installSkillDirectoriesMock.mockImplementation(async (skills, providers) =>
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
				providers: ["codex"],
			},
		};

		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan, resolutions: {} }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			discovery: { skills: number };
		};
		expect(installSkillDirectoriesMock).toHaveBeenCalledTimes(2);
		const installedSkillNames = installSkillDirectoriesMock.mock.calls
			.map((call) => call[0]?.[0]?.name)
			.sort();
		expect(installedSkillNames).toEqual(["skill-a", "skill-b"]);
		expect(body.discovery.skills).toBe(2);
	});

	test('accepts global query values "1", "0", and empty string', async () => {
		const trueLike = await fetch(`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=1`);
		expect(trueLike.status).toBe(200);

		const falseLike = await fetch(`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=0`);
		expect(falseLike.status).toBe(200);

		const emptyLike = await fetch(`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=`);
		expect(emptyLike.status).toBe(200);
	});

	test("legacy execution installs per-item in parallel and preserves item tagging", async () => {
		getAgentSourcePathMock.mockReturnValueOnce("/tmp/agents");
		discoverAgentsMock.mockResolvedValueOnce([
			{
				name: "agent-a",
				displayName: "Agent A",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-a.md",
				frontmatter: {},
				body: "agent a",
			},
			{
				name: "agent-b",
				displayName: "Agent B",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-b.md",
				frontmatter: {},
				body: "agent b",
			},
		]);

		let releaseFirstCall: () => void = () => {};
		let callCount = 0;
		installPortableItemsMock.mockImplementation(async (items, providers, type) => {
			if (type !== "agent") return [];
			callCount += 1;
			if (callCount === 1) {
				await new Promise<void>((resolve) => {
					releaseFirstCall = () => resolve();
				});
			}
			const item = items[0] as { name?: string } | undefined;
			const itemName = item?.name ?? "unknown";
			return providers.map((provider) => ({
				provider: String(provider) as PortableInstallBatch[number]["provider"],
				providerDisplayName: String(provider),
				success: true,
				path: `/tmp/${String(provider)}/${itemName}`,
			}));
		});

		const responsePromise = fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: {
					agents: true,
					commands: false,
					skills: false,
					config: false,
					rules: false,
				hooks: false,
				},
				global: true,
			}),
		});

		for (let attempt = 0; attempt < 40 && callCount < 2; attempt += 1) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		const callCountBeforeRelease = callCount;
		releaseFirstCall();

		const res = await responsePromise;
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			counts: { installed: number };
			results: Array<{ itemName?: string }>;
		};

		expect(callCountBeforeRelease).toBe(2);
		expect(body.counts.installed).toBe(2);
		const itemNames = body.results.map((entry) => entry.itemName).sort();
		expect(itemNames).toEqual(["agent-a", "agent-b"]);
	});

	test("validates providers query and sanitizes unknown provider tokens", async () => {
		const missingProviders = await fetch(`${ctx.baseUrl}/api/migrate/reconcile`);
		expect(missingProviders.status).toBe(400);
		const missingBody = (await missingProviders.json()) as { error: string };
		expect(missingBody.error).toBe("providers parameter is required");

		const rawUnknownProvider = "  bad\tprovider\u0007\nname  ";
		const invalidProviders = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=${encodeURIComponent(rawUnknownProvider)}`,
		);
		expect(invalidProviders.status).toBe(400);
		const invalidBody = (await invalidProviders.json()) as { error: string };
		expect(invalidBody.error).toContain("Unknown provider: bad provider name");
		expect(invalidBody.error.includes("\n")).toBe(false);
		expect(invalidBody.error.includes("\t")).toBe(false);
		expect(invalidBody.error.includes("\u0007")).toBe(false);
	});

	test("deduplicates query providers before boundary checks", async () => {
		const duplicatedProviders = ["codex", "cursor", "codex", "cursor", "codex"].join(",");
		const dedupedRes = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=${duplicatedProviders}`,
		);
		expect(dedupedRes.status).toBe(200);
		const dedupedBody = (await dedupedRes.json()) as {
			plan: { meta?: { providers?: string[] } };
		};
		expect(dedupedBody.plan.meta?.providers).toEqual(["codex", "cursor"]);

		const manyDuplicates = Array.from({ length: 21 }, () => "codex").join(",");
		const manyDuplicatesRes = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=${manyDuplicates}`,
		);
		expect(manyDuplicatesRes.status).toBe(200);
		const manyDuplicatesBody = (await manyDuplicatesRes.json()) as {
			plan: { meta?: { providers?: string[] } };
		};
		expect(manyDuplicatesBody.plan.meta?.providers).toEqual(["codex"]);
	});

	test("validates providers body shape and value, then deduplicates duplicates", async () => {
		const missingProviders = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ include: { agents: true } }),
		});
		expect(missingProviders.status).toBe(400);
		const missingBody = (await missingProviders.json()) as { error: string };
		expect(missingBody.error).toContain("providers is required and must be a non-empty array");

		const invalidShape = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: "codex",
				include: { agents: true },
			}),
		});
		expect(invalidShape.status).toBe(400);
		const invalidShapeBody = (await invalidShape.json()) as { error: string };
		expect(invalidShapeBody.error).toContain("providers is required and must be a non-empty array");

		const unknownProvider = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex", "not-a-provider"],
				include: { agents: true },
			}),
		});
		expect(unknownProvider.status).toBe(400);
		const unknownBody = (await unknownProvider.json()) as { error: string };
		expect(unknownBody.error).toContain("Unknown provider: not-a-provider");

		getAgentSourcePathMock.mockReturnValueOnce("/tmp/agents");
		discoverAgentsMock.mockResolvedValueOnce([
			{
				name: "agent-a",
				displayName: "Agent A",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-a.md",
				frontmatter: {},
				body: "agent a",
			},
		]);
		installPortableItemsMock.mockImplementationOnce(async (items, providers) => {
			const item = (items[0] as { name?: string } | undefined)?.name ?? "unknown";
			return providers.map((provider) => ({
				provider: String(provider) as PortableInstallBatch[number]["provider"],
				providerDisplayName: String(provider),
				success: true,
				path: `/tmp/${String(provider)}/${item}`,
			}));
		});

		const deduped = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: Array.from({ length: 21 }, () => "codex"),
				include: {
					agents: true,
					commands: false,
					skills: false,
					config: false,
					rules: false,
				hooks: false,
				},
			}),
		});
		expect(deduped.status).toBe(200);
		expect(installPortableItemsMock).toHaveBeenCalledTimes(1);
		expect(installPortableItemsMock.mock.calls[0]?.[1]).toEqual(["codex"]);
	});

	test("validates include shape, values, and all-false behavior", async () => {
		const invalidIncludeShape = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: "all",
			}),
		});
		expect(invalidIncludeShape.status).toBe(400);
		const invalidIncludeShapeBody = (await invalidIncludeShape.json()) as { error: string };
		expect(invalidIncludeShapeBody.error).toBe("include must be an object");

		const invalidIncludeValue = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: { agents: "yes" },
			}),
		});
		expect(invalidIncludeValue.status).toBe(400);
		const invalidIncludeValueBody = (await invalidIncludeValue.json()) as { error: string };
		expect(invalidIncludeValueBody.error).toBe("agents must be a boolean");

		const allFalseBody = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: {
					agents: false,
					commands: false,
					skills: false,
					config: false,
					rules: false,
				hooks: false,
				},
			}),
		});
		expect(allFalseBody.status).toBe(400);
		const allFalseBodyJson = (await allFalseBody.json()) as { error: string };
		expect(allFalseBodyJson.error).toBe("At least one migration type must be enabled");

		const invalidIncludeQuery = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&agents=maybe`,
		);
		expect(invalidIncludeQuery.status).toBe(400);
		const invalidIncludeQueryBody = (await invalidIncludeQuery.json()) as { error: string };
		expect(invalidIncludeQueryBody.error).toBe("agents must be a boolean");

		const allFalseQuery = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&agents=false&commands=false&skills=false&config=false&rules=false&hooks=false`,
		);
		expect(allFalseQuery.status).toBe(400);
		const allFalseQueryBody = (await allFalseQuery.json()) as { error: string };
		expect(allFalseQueryBody.error).toBe("At least one migration type must be enabled");
	});

	test("parses global query/body values and rejects invalid values", async () => {
		const trueQuery = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=true`,
		);
		expect(trueQuery.status).toBe(200);

		const falseQuery = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=false`,
		);
		expect(falseQuery.status).toBe(200);

		const invalidQuery = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&global=not-boolean`,
		);
		expect(invalidQuery.status).toBe(400);
		const invalidQueryBody = (await invalidQuery.json()) as { error: string };
		expect(invalidQueryBody.error).toBe("global must be a boolean");

		const trueBody = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: {
					agents: true,
					commands: false,
					skills: false,
					config: false,
					rules: false,
				hooks: false,
				},
				global: "true",
			}),
		});
		expect(trueBody.status).toBe(200);
		const trueBodyJson = (await trueBody.json()) as { effectiveGlobal: boolean };
		expect(trueBodyJson.effectiveGlobal).toBe(true);

		const falseBody = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: {
					agents: true,
					commands: false,
					skills: false,
					config: false,
					rules: false,
				hooks: false,
				},
				global: "false",
			}),
		});
		expect(falseBody.status).toBe(200);
		const falseBodyJson = (await falseBody.json()) as { effectiveGlobal: boolean };
		expect(falseBodyJson.effectiveGlobal).toBe(false);

		const invalidBody = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: { agents: true },
				global: "nope",
			}),
		});
		expect(invalidBody.status).toBe(400);
		const invalidBodyJson = (await invalidBody.json()) as { error: string };
		expect(invalidBodyJson.error).toBe("global must be a boolean");
	});

	test("accepts valid source values and rejects invalid source values", async () => {
		const projectSource = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&source=project`,
		);
		expect(projectSource.status).toBe(200);

		const localSource = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&source=local`,
		);
		expect(localSource.status).toBe(200);

		const defaultSource = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&source=default`,
		);
		expect(defaultSource.status).toBe(200);

		const invalidQuerySource = await fetch(
			`${ctx.baseUrl}/api/migrate/reconcile?providers=codex&source=unknown-source`,
		);
		expect(invalidQuerySource.status).toBe(400);
		const invalidQuerySourceBody = (await invalidQuerySource.json()) as { error: string };
		expect(invalidQuerySourceBody.error).toContain("Invalid source.");

		const invalidBodySourceType = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: { agents: true },
				source: 123,
			}),
		});
		expect(invalidBodySourceType.status).toBe(400);
		const invalidBodySourceTypeJson = (await invalidBodySourceType.json()) as { error: string };
		expect(invalidBodySourceTypeJson.error).toBe("source must be a string");

		const invalidBodySourceValue = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: { agents: true },
				source: "bad-source",
			}),
		});
		expect(invalidBodySourceValue.status).toBe(400);
		const invalidBodySourceValueJson = (await invalidBodySourceValue.json()) as { error: string };
		expect(invalidBodySourceValueJson.error).toContain("Invalid source.");
	});

	test("rejects plan summary and hasConflicts parity mismatches", async () => {
		const summaryMismatchPlan = {
			actions: [
				{
					action: "install",
					item: "agent-a",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: "/tmp/agent-a.md",
					reason: "Install agent",
				},
			],
			summary: { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 },
			hasConflicts: false,
			meta: {
				include: { agents: true, commands: false, skills: false, config: false, rules: false, hooks: false },
				providers: ["codex"],
			},
		};
		const summaryMismatchRes = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan: summaryMismatchPlan, resolutions: {} }),
		});
		expect(summaryMismatchRes.status).toBe(400);
		const summaryMismatchBody = (await summaryMismatchRes.json()) as { error: string };
		expect(summaryMismatchBody.error).toBe("Plan summary does not match action counts");

		const hasConflictsMismatchPlan = {
			actions: [
				{
					action: "install",
					item: "agent-a",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: "/tmp/agent-a.md",
					reason: "Install agent",
				},
			],
			summary: { install: 1, update: 0, skip: 0, conflict: 0, delete: 0 },
			hasConflicts: true,
			meta: {
				include: { agents: true, commands: false, skills: false, config: false, rules: false, hooks: false },
				providers: ["codex"],
			},
		};
		const hasConflictsMismatchRes = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan: hasConflictsMismatchPlan, resolutions: {} }),
		});
		expect(hasConflictsMismatchRes.status).toBe(400);
		const hasConflictsMismatchBody = (await hasConflictsMismatchRes.json()) as { error: string };
		expect(hasConflictsMismatchBody.error).toBe(
			"Plan hasConflicts does not match conflict actions",
		);
	});

	test("accepts legacy conflict key format and returns 409 for unresolved conflicts", async () => {
		const plan = {
			actions: [
				{
					action: "conflict",
					item: "cfg",
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
				include: { agents: false, commands: false, skills: false, config: true, rules: false, hooks: false },
				providers: ["codex"],
			},
		};

		const legacyKey = "codex:config:cfg:true";
		const resolvedRes = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plan,
				resolutions: {
					[legacyKey]: { type: "keep" },
				},
			}),
		});
		expect(resolvedRes.status).toBe(200);

		const unresolvedRes = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plan,
				resolutions: {},
			}),
		});
		expect(unresolvedRes.status).toBe(409);
		const unresolvedBody = (await unresolvedRes.json()) as { error: string };
		expect(unresolvedBody.error).toBe("Unresolved conflict: codex/config/cfg");
	});

	test("maps keep and smart-merge conflict resolutions correctly", async () => {
		const keepPlan = {
			actions: [
				{
					action: "conflict",
					item: "agent-a",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: "/tmp/agent-a.md",
					reason: "Conflict",
				},
			],
			summary: { install: 0, update: 0, skip: 0, conflict: 1, delete: 0 },
			hasConflicts: true,
			meta: {
				include: { agents: true, commands: false, skills: false, config: false, rules: false, hooks: false },
				providers: ["codex"],
			},
		};
		const keepKey = JSON.stringify(["codex", "agent", "agent-a", true]);
		const keepRes = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plan: keepPlan,
				resolutions: {
					[keepKey]: { type: "keep" },
				},
			}),
		});
		expect(keepRes.status).toBe(200);
		const keepBody = (await keepRes.json()) as {
			counts: { installed: number; skipped: number; failed: number };
		};
		expect(keepBody.counts).toEqual({ installed: 0, skipped: 0, failed: 0 });
		expect(installPortableItemsMock).toHaveBeenCalledTimes(0);

		getAgentSourcePathMock.mockReturnValueOnce("/tmp/agents");
		discoverAgentsMock.mockResolvedValueOnce([
			{
				name: "agent-a",
				displayName: "Agent A",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-a.md",
				frontmatter: {},
				body: "agent a",
			},
		]);
		installPortableItemsMock.mockReset();
		installPortableItemsMock.mockResolvedValueOnce([
			{
				provider: "codex",
				providerDisplayName: "Codex",
				success: true,
				path: "/tmp/codex/agent-a.md",
			},
		]);

		const smartMergePlan = {
			actions: [
				{
					action: "conflict",
					item: "agent-a",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: "/tmp/codex/agent-a.md",
					reason: "Conflict",
				},
			],
			summary: { install: 0, update: 0, skip: 0, conflict: 1, delete: 0 },
			hasConflicts: true,
			meta: {
				include: { agents: true, commands: false, skills: false, config: false, rules: false, hooks: false },
				providers: ["codex"],
			},
		};
		const smartMergeKey = JSON.stringify(["codex", "agent", "agent-a", true]);
		const smartMergeRes = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plan: smartMergePlan,
				resolutions: {
					[smartMergeKey]: { type: "smart-merge" },
				},
			}),
		});
		expect(smartMergeRes.status).toBe(200);
		const smartMergeBody = (await smartMergeRes.json()) as {
			counts: { installed: number; skipped: number; failed: number };
		};
		expect(smartMergeBody.counts.installed).toBe(1);
		expect(installPortableItemsMock).toHaveBeenCalledTimes(1);
		expect(installPortableItemsMock.mock.calls[0]?.[2]).toBe("agent");
	});

	test("skips plan actions when provider does not support action type", async () => {
		const plan = {
			actions: [
				{
					action: "install",
					item: "cmd-a",
					type: "command",
					provider: "cursor",
					global: false,
					targetPath: "/tmp/cmd-a.md",
					reason: "Install command",
				},
			],
			summary: { install: 1, update: 0, skip: 0, conflict: 0, delete: 0 },
			hasConflicts: false,
			meta: {
				include: { agents: false, commands: true, skills: false, config: false, rules: false, hooks: false },
				providers: ["cursor"],
			},
		};

		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan, resolutions: {} }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			results: Array<{ skipped?: boolean; skipReason?: string }>;
			counts: { skipped: number };
		};
		expect(body.counts.skipped).toBe(1);
		expect(body.results[0]?.skipped).toBe(true);
		expect(body.results[0]?.skipReason).toContain("does not support command");
		expect(installPortableItemsMock).toHaveBeenCalledTimes(0);
	});

	test("preserves delete target path when a newer action writes the same path", async () => {
		const sharedTargetPath = join(ctx.testHome, "agent-a.md");
		getAgentSourcePathMock.mockReturnValueOnce("/tmp/agents");
		discoverAgentsMock.mockResolvedValueOnce([
			{
				name: "agent-a",
				displayName: "Agent A",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-a.md",
				frontmatter: {},
				body: "agent a",
			},
		]);
		installPortableItemsMock.mockResolvedValueOnce([
			{
				provider: "codex",
				providerDisplayName: "Codex",
				success: true,
				path: sharedTargetPath,
			},
		]);

		const plan = {
			actions: [
				{
					action: "update",
					item: "agent-a",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: sharedTargetPath,
					reason: "Update existing agent",
				},
				{
					action: "delete",
					item: "agent-legacy",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: sharedTargetPath,
					reason: "Delete stale entry",
				},
			],
			summary: { install: 0, update: 1, skip: 0, conflict: 0, delete: 1 },
			hasConflicts: false,
			meta: {
				include: { agents: true, commands: false, skills: false, config: false, rules: false, hooks: false },
				providers: ["codex"],
			},
		};

		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan, resolutions: {} }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			results: Array<{ itemName?: string; skipped?: boolean; skipReason?: string }>;
			counts: { installed: number; skipped: number };
		};
		expect(body.counts.installed).toBe(1);
		expect(body.counts.skipped).toBe(1);
		const deleteResult = body.results.find((entry) => entry.itemName === "agent-legacy");
		expect(deleteResult?.skipped).toBe(true);
		expect(deleteResult?.skipReason).toContain(
			"target preserved because newer action wrote same path",
		);
		expect(removePortableInstallationMock).toHaveBeenCalledTimes(1);
	});

	test("returns plan execution results in deterministic sorted order", async () => {
		getAgentSourcePathMock.mockReturnValueOnce("/tmp/agents");
		discoverAgentsMock.mockResolvedValueOnce([
			{
				name: "agent-a",
				displayName: "Agent A",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-a.md",
				frontmatter: {},
				body: "agent a",
			},
			{
				name: "agent-b",
				displayName: "Agent B",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-b.md",
				frontmatter: {},
				body: "agent b",
			},
		]);
		installPortableItemsMock.mockImplementation(async (items, providers) => {
			const item = (items[0] as { name?: string } | undefined)?.name ?? "unknown";
			return providers.map((provider) => ({
				provider: String(provider) as PortableInstallBatch[number]["provider"],
				providerDisplayName: String(provider),
				success: true,
				path: `/tmp/${String(provider)}/${item}`,
			}));
		});

		const plan = {
			actions: [
				{
					action: "install",
					item: "agent-b",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: "/tmp/codex/agent-b",
					reason: "Install B",
				},
				{
					action: "install",
					item: "agent-a",
					type: "agent",
					provider: "codex",
					global: true,
					targetPath: "/tmp/codex/agent-a",
					reason: "Install A",
				},
			],
			summary: { install: 2, update: 0, skip: 0, conflict: 0, delete: 0 },
			hasConflicts: false,
			meta: {
				include: { agents: true, commands: false, skills: false, config: false, rules: false, hooks: false },
				providers: ["codex"],
			},
		};

		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ plan, resolutions: {} }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { results: Array<{ itemName?: string }> };
		expect(body.results.map((entry) => entry.itemName)).toEqual(["agent-a", "agent-b"]);
	});

	test("returns legacy execution results in deterministic sorted order", async () => {
		getAgentSourcePathMock.mockReturnValueOnce("/tmp/agents");
		discoverAgentsMock.mockResolvedValueOnce([
			{
				name: "agent-b",
				displayName: "Agent B",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-b.md",
				frontmatter: {},
				body: "agent b",
			},
			{
				name: "agent-a",
				displayName: "Agent A",
				description: "",
				type: "agent",
				sourcePath: "/tmp/agents/agent-a.md",
				frontmatter: {},
				body: "agent a",
			},
		]);
		installPortableItemsMock.mockImplementation(async (items, providers) => {
			const item = (items[0] as { name?: string } | undefined)?.name ?? "unknown";
			return providers.map((provider) => ({
				provider: String(provider) as PortableInstallBatch[number]["provider"],
				providerDisplayName: String(provider),
				success: true,
				path: `/tmp/${String(provider)}/${item}`,
			}));
		});

		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: {
					agents: true,
					commands: false,
					skills: false,
					config: false,
					rules: false,
				hooks: false,
				},
				global: true,
			}),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { results: Array<{ itemName?: string }> };
		expect(body.results.map((entry) => entry.itemName)).toEqual(["agent-a", "agent-b"]);
	});

	test("sanitizes reconcile failure message in 500 response", async () => {
		readPortableRegistryMock.mockRejectedValueOnce(new Error("reconcile\tboom\nbad\u0007"));

		const res = await fetch(`${ctx.baseUrl}/api/migrate/reconcile?providers=codex`);
		expect(res.status).toBe(500);
		const body = (await res.json()) as { error: string; message: string };
		expect(body.error).toBe("Failed to compute reconcile plan");
		expect(body.message).toContain("reconcile boom bad");
		expect(body.message.includes("\n")).toBe(false);
		expect(body.message.includes("\t")).toBe(false);
		expect(body.message.includes("\u0007")).toBe(false);
	});

	test("sanitizes execute failure message in 500 response", async () => {
		getAgentSourcePathMock.mockReturnValueOnce("/tmp/agents");
		discoverAgentsMock.mockRejectedValueOnce(new Error("execute\tboom\nbad\u0007"));

		const res = await fetch(`${ctx.baseUrl}/api/migrate/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				providers: ["codex"],
				include: {
					agents: true,
					commands: false,
					skills: false,
					config: false,
					rules: false,
				hooks: false,
				},
			}),
		});
		expect(res.status).toBe(500);
		const body = (await res.json()) as { error: string; message: string };
		expect(body.error).toBe("Failed to execute migration");
		expect(body.message).toContain("execute boom bad");
		expect(body.message.includes("\n")).toBe(false);
		expect(body.message.includes("\t")).toBe(false);
		expect(body.message.includes("\u0007")).toBe(false);
	});
});
