import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { InitContext } from "@/commands/init/types.js";

type ExecCallback = (error: Error | null, stdout?: string, stderr?: string) => void;

const execCalls: string[] = [];
let execError: Error | null = null;

mock.module("node:child_process", () => ({
	exec: (
		command: string,
		options: { timeout?: number } | ExecCallback,
		callback?: ExecCallback,
	) => {
		execCalls.push(command);
		const cb = typeof options === "function" ? options : callback;
		if (cb) {
			cb(execError, "", "");
		}
		return {} as never;
	},
}));

const detectInstalledProvidersMock = mock(async () => [] as string[]);
const getProviderConfigMock = mock((provider: string) => ({ displayName: provider }));
mock.module("@/commands/portable/provider-registry.js", () => ({
	detectInstalledProviders: detectInstalledProvidersMock,
	getProviderConfig: getProviderConfigMock,
}));

const readPortableRegistryMock = mock(async () => ({ version: "3.0", installations: [] as any[] }));
mock.module("@/commands/portable/portable-registry.js", () => ({
	readPortableRegistry: readPortableRegistryMock,
}));

const loadFullMock = mock(
	async (_projectDir: string | null) =>
		({ config: { updatePipeline: undefined } }) as {
			config: {
				updatePipeline?:
					| {
							autoMigrateAfterInit?: boolean;
							migrateProviders?: "auto" | string[];
					  }
					| undefined;
			};
		},
);
mock.module("@/domains/config/ck-config-manager.js", () => ({
	CkConfigManager: {
		loadFull: (projectDir: string | null) => loadFullMock(projectDir),
	},
}));

const noteMock = mock((_message: string, _title?: string) => {});
const confirmMock = mock(async (_options: { message: string }) => false as boolean | string);
const isCancelMock = mock((value: unknown) => value === "cancelled");
mock.module("@/shared/safe-prompts.js", () => ({
	confirm: (options: { message: string }) => confirmMock(options),
	isCancel: (value: unknown) => isCancelMock(value),
	note: (message: string, title?: string) => noteMock(message, title),
}));

const { maybePostInitMigrate } = await import("@/commands/init/phases/post-init-migrate-nudge.js");
const { logger } = await import("@/shared/logger.js");

function createContext(overrides: Partial<InitContext> = {}): InitContext {
	return {
		rawOptions: {},
		options: {
			kit: "engineer",
			dir: ".",
			beta: false,
			global: false,
			yes: true,
			fresh: false,
			refresh: false,
			exclude: [],
			only: [],
			installSkills: false,
			withSudo: false,
			skipSetup: true,
			forceOverwrite: false,
			forceOverwriteSettings: false,
			dryRun: false,
			prefix: false,
			sync: false,
			useGit: false,
		},
		prompts: {} as any,
		explicitDir: false,
		isNonInteractive: false,
		resolvedDir: "/tmp/project",
		customClaudeFiles: [],
		includePatterns: [],
		installSkills: false,
		cancelled: false,
		...overrides,
	} as InitContext;
}

describe("maybePostInitMigrate", () => {
	let loggerSpies: Array<{ mockRestore: () => void }> = [];

	beforeEach(() => {
		execCalls.length = 0;
		execError = null;
		detectInstalledProvidersMock.mockReset();
		detectInstalledProvidersMock.mockResolvedValue([]);
		getProviderConfigMock.mockReset();
		getProviderConfigMock.mockImplementation((provider: string) => ({
			displayName:
				{
					codex: "Codex",
					"gemini-cli": "Gemini CLI",
					antigravity: "Antigravity",
					cursor: "Cursor",
				}[provider] ?? provider,
		}));
		readPortableRegistryMock.mockReset();
		readPortableRegistryMock.mockResolvedValue({ version: "3.0", installations: [] });
		loadFullMock.mockReset();
		loadFullMock.mockResolvedValue({ config: { updatePipeline: undefined } });
		noteMock.mockReset();
		confirmMock.mockReset();
		confirmMock.mockResolvedValue(false);
		isCancelMock.mockReset();
		isCancelMock.mockImplementation((value: unknown) => value === "cancelled");
		loggerSpies = [
			spyOn(logger, "info").mockImplementation(() => {}),
			spyOn(logger, "success").mockImplementation(() => {}),
			spyOn(logger, "warning").mockImplementation(() => {}),
			spyOn(logger, "debug").mockImplementation(() => {}),
		];
	});

	afterEach(() => {
		for (const spy of loggerSpies) spy.mockRestore();
	});

	afterAll(() => {
		mock.restore();
	});

	test("returns early when cancelled", async () => {
		await maybePostInitMigrate(createContext({ cancelled: true }));
		expect(detectInstalledProvidersMock).not.toHaveBeenCalled();
	});

	test("returns early when only claude-code is detected", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code"]);
		await maybePostInitMigrate(createContext());
		expect(readPortableRegistryMock).not.toHaveBeenCalled();
		expect(execCalls).toEqual([]);
	});

	test("nudges first-time interactive users and runs migrate on confirmation", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		confirmMock.mockResolvedValue(true);
		await maybePostInitMigrate(createContext());
		expect(noteMock).toHaveBeenCalledWith(
			expect.stringContaining("Detected providers: Codex"),
			"[i] Provider Sync Available",
		);
		expect(confirmMock).toHaveBeenCalledWith({ message: "Run ck migrate now?" });
		expect(execCalls).toEqual(["ck migrate --yes"]);
		expect(loadFullMock).toHaveBeenCalledWith("/tmp/project");
	});

	test("skips the nudge when migrate history already exists", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex"]);
		readPortableRegistryMock.mockResolvedValue({
			version: "3.0",
			installations: [{ provider: "codex" }],
		});
		await maybePostInitMigrate(createContext());
		expect(noteMock).not.toHaveBeenCalled();
		expect(execCalls).toEqual([]);
	});

	test("auto-migrate takes priority over the first-time nudge", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex", "gemini-cli"]);
		loadFullMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterInit: true, migrateProviders: "auto" } },
		});
		confirmMock.mockImplementation(async () => {
			throw new Error("confirm should not be reached");
		});
		await maybePostInitMigrate(createContext());
		expect(confirmMock).not.toHaveBeenCalled();
		expect(execCalls).toEqual(["ck migrate --agent codex --agent gemini-cli --yes"]);
	});

	test("respects configured migrate providers and adds -g for global mode", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex", "gemini-cli"]);
		loadFullMock.mockResolvedValue({
			config: {
				updatePipeline: {
					autoMigrateAfterInit: true,
					migrateProviders: ["gemini-cli", "cursor"],
				},
			},
		});
		await maybePostInitMigrate(
			createContext({ options: { ...createContext().options, global: true } }),
		);
		expect(logger.warning).toHaveBeenCalledWith(
			expect.stringContaining("Unknown/uninstalled providers in migrateProviders: cursor"),
		);
		expect(execCalls).toEqual(["ck migrate -g --agent gemini-cli --yes"]);
	});

	test("skips unsafe provider names before building the migrate command", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex", "bad;rm -rf"]);
		loadFullMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterInit: true, migrateProviders: "auto" } },
		});
		await maybePostInitMigrate(createContext());
		expect(logger.warning).toHaveBeenCalledWith(
			"Some provider names contain invalid characters and were skipped",
		);
		expect(execCalls).toEqual(["ck migrate --agent codex --yes"]);
	});

	test("logs and swallows failures from the post-init check", async () => {
		detectInstalledProvidersMock.mockRejectedValue(new Error("boom"));
		await maybePostInitMigrate(createContext());
		expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("boom"));
	});
});
