import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { PromptMigrateUpdateDeps } from "@/commands/update-cli.js";
import { promptMigrateUpdate } from "@/commands/update-cli.js";
import { logger } from "@/shared/logger.js";
import type { MigrateScopeConfig } from "@/types/ck-config.js";

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
							migrateScope?: MigrateScopeConfig;
					  }
					| undefined;
			};
		},
);

const execCalls: string[] = [];
const cleanupCalls: Array<{ providers: string[]; global: boolean }> = [];
const repairCalls: string[] = [];
const legacyRepairCalls: string[] = [];
const orderedCalls: string[] = [];

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
			orderedCalls.push("exec");
			execCalls.push(command);
			return { stdout: "", stderr: "" };
		},
		cleanupMigratedHooksFn: async (providers, options) => {
			orderedCalls.push("cleanup");
			cleanupCalls.push({ providers, global: options.global });
			return [];
		},
		repairHookFileReferencesFn: async (projectDir) => {
			orderedCalls.push("repair");
			repairCalls.push(projectDir);
			return 0;
		},
		repairLegacyHookPromptsFn: async (projectDir) => {
			orderedCalls.push("legacy");
			legacyRepairCalls.push(projectDir);
			return 0;
		},
	};
}

describe("promptMigrateUpdate (step 3 of update pipeline)", () => {
	beforeEach(() => {
		execCalls.length = 0;
		cleanupCalls.length = 0;
		repairCalls.length = 0;
		legacyRepairCalls.length = 0;
		orderedCalls.length = 0;
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
		expect(legacyRepairCalls).toEqual([process.cwd(), process.cwd()]);
		expect(repairCalls).toEqual([process.cwd(), process.cwd()]);
		expect(execCalls).toEqual([]);
	});

	test("skips when no providers detected", async () => {
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(legacyRepairCalls).toEqual([process.cwd()]);
		expect(repairCalls).toEqual([process.cwd()]);
		expect(execCalls).toEqual([]);
	});

	test("logs legacy hook prompt repairs even when no providers are detected", async () => {
		const deps = makeDeps();
		deps.repairLegacyHookPromptsFn = async (projectDir) => {
			orderedCalls.push("legacy");
			legacyRepairCalls.push(projectDir);
			return 2;
		};

		await promptMigrateUpdate(deps);

		expect(legacyRepairCalls).toEqual([process.cwd()]);
		expect(logger.info).toHaveBeenCalledWith("Pruned 2 legacy hook prompt(s)");
		expect(execCalls).toEqual([]);
	});

	test("logs hook file reference repairs even when no providers are detected", async () => {
		const deps = makeDeps();
		deps.repairHookFileReferencesFn = async (projectDir) => {
			orderedCalls.push("repair");
			repairCalls.push(projectDir);
			return 2;
		};

		await promptMigrateUpdate(deps);

		expect(repairCalls).toEqual([process.cwd()]);
		expect(logger.info).toHaveBeenCalledWith("Repaired 2 missing hook file reference(s)");
		expect(execCalls).toEqual([]);
	});

	test("continues migration step when hook file reference repair fails", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		const deps = makeDeps();
		deps.repairHookFileReferencesFn = async () => {
			orderedCalls.push("repair");
			throw new Error("repair failed");
		};

		await promptMigrateUpdate(deps);

		expect(logger.verbose).toHaveBeenCalledWith(
			expect.stringContaining("Hook file reference repair skipped: repair failed"),
		);
		expect(execCalls).toEqual(["ck migrate --agent codex --yes"]);
	});

	test("runs missing hook repair again after migrated hook cleanup", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["codex"]);
		const repairResults = [0, 2];
		const deps = makeDeps();
		deps.repairHookFileReferencesFn = async (projectDir) => {
			orderedCalls.push("repair");
			repairCalls.push(projectDir);
			return repairResults.shift() ?? 0;
		};
		deps.cleanupMigratedHooksFn = async (providers, options) => {
			orderedCalls.push("cleanup");
			cleanupCalls.push({ providers, global: options.global });
			return [{ hooksPruned: 1, filesRemoved: 1, registryEntriesRemoved: 0 }];
		};

		await promptMigrateUpdate(deps);

		expect(orderedCalls).toEqual(["legacy", "repair", "cleanup", "legacy", "repair"]);
		expect(legacyRepairCalls).toEqual([process.cwd(), process.cwd()]);
		expect(repairCalls).toEqual([process.cwd(), process.cwd()]);
		expect(cleanupCalls).toEqual([{ providers: ["codex"], global: false }]);
		expect(logger.info).toHaveBeenCalledWith("Cleaned up 2 generated-context hook artifact(s)");
		expect(logger.info).toHaveBeenCalledWith("Repaired 2 missing hook file reference(s)");
		expect(execCalls).toEqual([]);
	});

	test("skips when only claude-code is detected", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(cleanupCalls).toEqual([]);
		expect(legacyRepairCalls).toEqual([process.cwd()]);
		expect(repairCalls).toEqual([process.cwd()]);
		expect(execCalls).toEqual([]);
	});

	test("auto-migrates all detected providers when configured", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex", "gemini-cli"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true, migrateProviders: "auto" } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(cleanupCalls).toEqual([{ providers: ["codex", "gemini-cli"], global: false }]);
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
		expect(cleanupCalls).toEqual([{ providers: ["codex"], global: true }]);
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

	test("emits --skip-skills when migrateScope.skills is false (symlink scenario)", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: {
				updatePipeline: {
					autoMigrateAfterUpdate: true,
					migrateScope: { skills: false },
				},
			},
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual(["ck migrate --agent codex --skip-skills --yes"]);
	});

	test("emits multiple --skip-X flags in deterministic order", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: {
				updatePipeline: {
					autoMigrateAfterUpdate: true,
					migrateScope: { skills: false, config: false, rules: false },
				},
			},
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual([
			"ck migrate --agent codex --skip-skills --skip-config --skip-rules --yes",
		]);
	});

	test("does not emit --skip-X when migrateScope is absent (default behavior unchanged)", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoMigrateAfterUpdate: true } },
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual(["ck migrate --agent codex --yes"]);
	});

	test("does not emit --skip-X when all migrateScope fields are true", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: {
				updatePipeline: {
					autoMigrateAfterUpdate: true,
					migrateScope: { agents: true, commands: true, skills: true },
				},
			},
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual(["ck migrate --agent codex --yes"]);
	});

	test("ignores migrateScope entirely when autoMigrateAfterUpdate is false", async () => {
		detectInstalledProvidersMock.mockResolvedValue(["claude-code", "codex"]);
		loadFullConfigMock.mockResolvedValue({
			config: {
				updatePipeline: {
					autoMigrateAfterUpdate: false,
					migrateScope: { skills: false },
				},
			},
		});
		await promptMigrateUpdate(makeDeps());
		expect(execCalls).toEqual([]);
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
