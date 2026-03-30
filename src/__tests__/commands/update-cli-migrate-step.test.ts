import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { PromptMigrateUpdateDeps } from "@/commands/update-cli.js";
import { promptMigrateUpdate } from "@/commands/update-cli.js";
import { logger } from "@/shared/logger.js";

const detectInstalledProvidersMock = mock(async () => [] as string[]);
const getProviderConfigMock = mock((provider: string) => ({ displayName: provider }));
const loadFullConfigMock = mock(
	async (_projectDir: string | null) =>
		({ config: { updatePipeline: undefined } }) as {
			config: {
				updatePipeline?:
					| {
							autoMigrateAfterUpdate?: boolean;
							migrateProviders?: "auto" | string[];
					  }
					| undefined;
			};
		},
);

const execCalls: string[] = [];

function makeDeps(): PromptMigrateUpdateDeps {
	return {
		detectInstalledProvidersFn: detectInstalledProvidersMock,
		getProviderConfigFn: getProviderConfigMock,
		getSetupFn: async () => ({
			global: {
				path: "",
				metadata: null,
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
			project: {
				path: "/tmp/project",
				metadata: { kits: { engineer: { version: "1.0.0" } } },
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
		}),
		loadFullConfigFn: loadFullConfigMock,
		execAsyncFn: async (command: string) => {
			execCalls.push(command);
			return { stdout: "", stderr: "" };
		},
	};
}

describe("promptMigrateUpdate (step 3 of update pipeline)", () => {
	beforeEach(() => {
		execCalls.length = 0;
		detectInstalledProvidersMock.mockReset();
		detectInstalledProvidersMock.mockResolvedValue([]);
		getProviderConfigMock.mockReset();
		getProviderConfigMock.mockImplementation((provider: string) => ({
			displayName:
				{
					codex: "Codex",
					"gemini-cli": "Gemini CLI",
					cursor: "Cursor",
				}[provider] ?? provider,
		}));
		loadFullConfigMock.mockReset();
		loadFullConfigMock.mockResolvedValue({ config: { updatePipeline: undefined } });
		spyOn(logger, "info").mockImplementation(() => {});
		spyOn(logger, "success").mockImplementation(() => {});
		spyOn(logger, "warning").mockImplementation(() => {});
		spyOn(logger, "verbose").mockImplementation(() => {});
	});

	afterEach(() => {
		mock.restore();
	});

	test("skips when autoMigrateAfterUpdate is not configured", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual([]);
	});

	test("skips when no providers detected", async () => {
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual([]);
	});

	test("skips when only claude-code is detected", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual([]);
	});

	test("auto-migrates all detected providers when configured", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex", "gemini-cli"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true, migrateProviders: "auto" } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual(["ck migrate --agent codex --agent gemini-cli --yes"]);
	});

	test("filters to configured providers only", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex", "gemini-cli"]);
		loadFullConfigMock.mockResolvedValue({
			config: {
				updatePipeline: {
					autoMigrateAfterUpdate: true,
					migrateProviders: ["gemini-cli", "cursor"],
				},
			},
		});
		await promptMigrateUpdate(makeDeps());
		expect(logger.warning).toHaveBeenCalledWith(
			expect.stringContaining("Unknown/uninstalled providers in migrateProviders: cursor"),
		);
		expect(execCalls).toEqual(["ck migrate --agent gemini-cli --yes"]);
	});

	test("adds -g flag when global install is detected", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		const deps = makeDeps();
		deps.getSetupFn = async () => ({
			global: {
				path: "/global",
				metadata: { kits: { engineer: { version: "1.0.0" } } },
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
			project: {
				path: "",
				metadata: null,
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
		});
		await promptMigrateUpdate(deps);
		expect(execCalls).toEqual(["ck migrate -g --agent codex --yes"]);
	});

	test("skips unsafe provider names", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex", "bad;rm -rf"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true, migrateProviders: "auto" } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(logger.warning).toHaveBeenCalledWith(
			"Some provider names contain invalid characters and were skipped",
		);
		expect(execCalls).toEqual(["ck migrate --agent codex --yes"]);
	});

	test("handles exec failure gracefully", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		const deps = makeDeps();
		deps.execAsyncFn = async () => {
			throw new Error("command failed");
		};
		await promptMigrateUpdate(deps);
		expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining("Auto-migration failed"));
	});
});
