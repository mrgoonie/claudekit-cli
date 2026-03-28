import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
	type PostInitMigrateDeps,
	maybePostInitMigrate,
} from "@/commands/init/phases/post-init-migrate-nudge.js";
import type { InitContext } from "@/commands/init/types.js";
import { logger } from "@/shared/logger.js";

const detectInstalledProvidersMock = mock(async () => [] as string[]);
const getProviderConfigMock = mock((provider: string) => ({ displayName: provider }));
const readPortableRegistryMock = mock(
	async () =>
		({
			version: "3.0",
			installations: [] as Array<{ provider: string }>,
		}) as const,
);
const loadFullConfigMock = mock(
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
const noteMock = mock((_message: string, _title?: string) => {});
const confirmMock = mock(async (_options: { message: string }) => false);
const isCancelMock = mock((value: unknown) => value === "cancelled");

const execCalls: string[] = [];
let execError: Error | null = null;

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

function makeDeps(): PostInitMigrateDeps {
	return {
		detectInstalledProvidersFn: detectInstalledProvidersMock,
		getProviderConfigFn: getProviderConfigMock,
		readPortableRegistryFn: readPortableRegistryMock,
		loadFullConfigFn: loadFullConfigMock,
		confirmFn: confirmMock,
		isCancelFn: isCancelMock,
		noteFn: noteMock,
		execAsyncFn: async (command: string) => {
			execCalls.push(command);
			if (execError) {
				throw execError;
			}
			return { stdout: "", stderr: "" };
		},
	};
}

describe("maybePostInitMigrate", () => {
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
		loadFullConfigMock.mockReset();
		loadFullConfigMock.mockResolvedValue({ config: { updatePipeline: undefined } });
		noteMock.mockReset();
		confirmMock.mockReset();
		confirmMock.mockResolvedValue(false);
		isCancelMock.mockReset();
		isCancelMock.mockImplementation((value: unknown) => value === "cancelled");
		spyOn(logger, "info").mockImplementation(() => {});
		spyOn(logger, "success").mockImplementation(() => {});
		spyOn(logger, "warning").mockImplementation(() => {});
		spyOn(logger, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		mock.restore();
	});

	test("returns early when cancelled", async () => {
		await maybePostInitMigrate(createContext({ cancelled: true }), makeDeps());
		expect(detectInstalledProvidersMock).not.toHaveBeenCalled();
	});

	test("returns early when only claude-code is detected", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code"]);
		await maybePostInitMigrate(createContext(), makeDeps());
		expect(readPortableRegistryMock).not.toHaveBeenCalled();
		expect(execCalls).toEqual([]);
	});

	test("nudges first-time interactive users and runs migrate on confirmation", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		confirmMock.mockResolvedValue(true);
		await maybePostInitMigrate(createContext(), makeDeps());
		expect(noteMock).toHaveBeenCalledWith(
			expect.stringContaining("Detected providers: Codex"),
			"[i] Provider Sync Available",
		);
		expect(confirmMock).toHaveBeenCalledWith({ message: "Run ck migrate now?" });
		expect(execCalls).toEqual(["ck migrate --yes"]);
		expect(loadFullConfigMock).toHaveBeenCalledWith("/tmp/project");
	});

	test("skips the nudge when migrate history already exists", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex"]);
		readPortableRegistryMock.mockResolvedValue({
			version: "3.0",
			installations: [{ provider: "codex" }],
		});
		await maybePostInitMigrate(createContext(), makeDeps());
		expect(noteMock).not.toHaveBeenCalled();
		expect(execCalls).toEqual([]);
	});

	test("auto-migrate takes priority over the first-time nudge", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex", "gemini-cli"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterInit: true, migrateProviders: "auto" } },
		});
		confirmMock.mockImplementation(async () => {
			throw new Error("confirm should not be reached");
		});
		await maybePostInitMigrate(createContext(), makeDeps());
		expect(confirmMock).not.toHaveBeenCalled();
		expect(execCalls).toEqual(["ck migrate --agent codex --agent gemini-cli --yes"]);
	});

	test("respects configured migrate providers and adds -g for global mode", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex", "gemini-cli"]);
		loadFullConfigMock.mockResolvedValue({
			config: {
				updatePipeline: {
					autoMigrateAfterInit: true,
					migrateProviders: ["gemini-cli", "cursor"],
				},
			},
		});
		await maybePostInitMigrate(
			createContext({ options: { ...createContext().options, global: true } }),
			makeDeps(),
		);
		expect(logger.warning).toHaveBeenCalledWith(
			expect.stringContaining("Unknown/uninstalled providers in migrateProviders: cursor"),
		);
		expect(execCalls).toEqual(["ck migrate -g --agent gemini-cli --yes"]);
	});

	test("skips unsafe provider names before building the migrate command", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex", "bad;rm -rf"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterInit: true, migrateProviders: "auto" } },
		});
		await maybePostInitMigrate(createContext(), makeDeps());
		expect(logger.warning).toHaveBeenCalledWith(
			"Some provider names contain invalid characters and were skipped",
		);
		expect(execCalls).toEqual(["ck migrate --agent codex --yes"]);
	});

	test("logs and swallows failures from the post-init check", async () => {
		detectInstalledProvidersMock.mockRejectedValue(new Error("boom"));
		await maybePostInitMigrate(createContext(), makeDeps());
		expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("boom"));
	});
});
