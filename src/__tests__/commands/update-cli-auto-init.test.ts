import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PromptKitUpdateDeps } from "@/commands/update-cli.js";
import { promptKitUpdate } from "@/commands/update-cli.js";

const confirmMock = mock(async (_options: { message: string }) => true);
const isCancelMock = mock((value: unknown) => value === "cancelled");
const loadFullConfigMock = mock(
	async (_projectDir: string | null) =>
		({ config: { updatePipeline: undefined } }) as {
			config: {
				updatePipeline?:
					| {
							autoInitAfterUpdate?: boolean;
					  }
					| undefined;
			};
		},
);

async function writeMetadata(dir: string, version = "1.0.0") {
	await writeFile(
		join(dir, "metadata.json"),
		JSON.stringify({
			version: "1.0.0",
			kits: { engineer: { version, installedAt: "2025-01-01T00:00:00Z" } },
		}),
	);
}

async function writeGlobalHookState(
	dir: string,
	options: { disabled?: Record<string, boolean>; includeSessionState?: boolean } = {},
) {
	const hooks = [{ type: "command", command: 'node "$HOME/.claude/hooks/simplify-gate.cjs"' }];
	if (options.includeSessionState) {
		hooks.push({ type: "command", command: 'node "$HOME/.claude/hooks/session-state.cjs"' });
	}

	await writeFile(
		join(dir, "settings.json"),
		JSON.stringify(
			{
				hooks: {
					UserPromptSubmit: [{ hooks }],
				},
			},
			null,
			2,
		),
	);
	await writeFile(
		join(dir, ".ck.json"),
		JSON.stringify(
			{
				hooks: options.disabled ?? {},
				kits: {
					"ClaudeKit Engineer": {
						installedSettings: {
							hooks: [
								"node $HOME/.claude/hooks/simplify-gate.cjs",
								"node $HOME/.claude/hooks/session-state.cjs",
							],
							mcpServers: [],
						},
					},
				},
			},
			null,
			2,
		),
	);
}

describe("promptKitUpdate auto-init behavior", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-auto-init-"));
		await writeMetadata(tempDir);
		confirmMock.mockReset();
		confirmMock.mockResolvedValue(true);
		isCancelMock.mockReset();
		isCancelMock.mockImplementation((value: unknown) => value === "cancelled");
		loadFullConfigMock.mockReset();
		loadFullConfigMock.mockResolvedValue({ config: { updatePipeline: undefined } });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	/** Create test deps with exec mock (for -y mode) and spawn mock (for interactive mode) */
	function makeDeps() {
		let execCount = 0;
		let spawnCount = 0;
		let capturedExecCmd = "";
		let capturedSpawnArgs: string[] = [];
		const deps: PromptKitUpdateDeps = {
			execAsyncFn: async (cmd: string) => {
				execCount++;
				capturedExecCmd = cmd;
				return { stdout: "", stderr: "" };
			},
			spawnInitFn: async (args: string[]) => {
				spawnCount++;
				capturedSpawnArgs = args;
				return 0;
			},
			getSetupFn: async () => ({
				global: {
					path: tempDir,
					metadata: {
						version: "1.0.0",
						name: "ClaudeKit",
						description: "test install",
						kits: { engineer: { version: "1.0.0" } },
					},
					components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
				},
				project: {
					path: "",
					metadata: null,
					components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
				},
			}),
			spinnerFn: () => ({
				start: () => {},
				stop: () => {},
				message: () => {},
			}),
			getLatestReleaseTagFn: async () => null,
			loadFullConfigFn: loadFullConfigMock,
			confirmFn: confirmMock,
			isCancelFn: isCancelMock,
		};
		return {
			deps,
			execCount: () => execCount,
			spawnCount: () => spawnCount,
			capturedExecCmd: () => capturedExecCmd,
			capturedSpawnArgs: () => capturedSpawnArgs,
		};
	}

	// --- Interactive mode (spawn) tests ---

	test("interactive mode uses spawn with inherited stdio (not exec)", async () => {
		const { deps, execCount, spawnCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
	});

	test("interactive mode passes -g and --install-skills to spawn args", async () => {
		const { deps, capturedSpawnArgs } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).toContain("-g");
		expect(capturedSpawnArgs()).toContain("--install-skills");
		expect(capturedSpawnArgs()).not.toContain("--kit");
		expect(capturedSpawnArgs()).not.toContain("--yes");
	});

	test("interactive mode does NOT pass --kit, letting ck init show kit picker", async () => {
		const { deps, capturedSpawnArgs } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).not.toContain("--kit");
		expect(capturedSpawnArgs()).not.toContain("engineer");
	});

	test("autoInitAfterUpdate uses spawn (interactive kit selection)", async () => {
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		confirmMock.mockImplementation(async () => {
			throw new Error("confirm should not be reached");
		});
		const { deps, spawnCount, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(confirmMock).not.toHaveBeenCalled();
		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
	});

	test("autoInitAfterUpdate does NOT pass --yes or --kit via spawn", async () => {
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		const { deps, capturedSpawnArgs } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).not.toContain("--yes");
		expect(capturedSpawnArgs()).not.toContain("--kit");
		expect(capturedSpawnArgs()).toContain("--install-skills");
	});

	// --- Non-interactive mode (exec) tests ---

	test("explicit -y flag uses exec with --yes and --kit (non-interactive)", async () => {
		const { deps, capturedExecCmd, execCount, spawnCount } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		await promptKitUpdate(false, true, deps);
		expect(execCount()).toBe(1);
		expect(spawnCount()).toBe(0);
		expect(capturedExecCmd()).toContain("--yes");
		expect(capturedExecCmd()).toContain("--kit engineer");
	});

	test("-y flag overrides autoInit: uses exec even when autoInitAfterUpdate is enabled", async () => {
		// When both -y and autoInit are set, -y wins: fully non-interactive via exec.
		// autoInit only matters when yes=false (it skips the confirmation prompt
		// but keeps ck init interactive via spawn). With yes=true, exec handles everything.
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		const { deps, execCount, spawnCount, capturedExecCmd } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);
		expect(execCount()).toBe(1);
		expect(spawnCount()).toBe(0);
		expect(capturedExecCmd()).toContain("--yes");
		expect(capturedExecCmd()).toContain("--kit engineer");
	});

	// --- Shared behavior tests ---

	test("prompts confirmation in interactive mode when autoInit is disabled", async () => {
		const { deps, spawnCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(confirmMock).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining("Update global ClaudeKit content"),
			}),
		);
		expect(spawnCount()).toBe(1);
	});

	test("does not run init when the manual confirmation is declined", async () => {
		confirmMock.mockResolvedValue(false);
		const { deps, execCount, spawnCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(execCount()).toBe(0);
		expect(spawnCount()).toBe(0);
	});

	test("falls back to the manual prompt when config loading fails", async () => {
		loadFullConfigMock.mockRejectedValue(new Error("config unavailable"));
		const { deps, spawnCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(confirmMock).toHaveBeenCalledTimes(1);
		expect(spawnCount()).toBe(1);
	});

	test("skips init when kit is at latest and autoInitAfterUpdate is disabled (--yes mode)", async () => {
		const { deps, execCount, spawnCount } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);
		expect(execCount()).toBe(0);
		expect(spawnCount()).toBe(0);
	});

	test("reinstalls latest kit when installed hooks have missing dependencies (--yes mode)", async () => {
		const hooksDir = join(tempDir, "hooks");
		await mkdir(hooksDir, { recursive: true });
		await writeFile(
			join(hooksDir, "usage-context-awareness.cjs"),
			"const quota = require('./usage-quota-cache-refresh.cjs');\nconsole.log(quota);\n",
		);

		const { deps, execCount, spawnCount, capturedExecCmd } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);
		expect(execCount()).toBe(1);
		expect(spawnCount()).toBe(0);
		expect(capturedExecCmd()).toContain("--yes");
		expect(capturedExecCmd()).toContain("--kit engineer");
	});

	test("restores missing global hook registrations during a kit update (--yes mode)", async () => {
		await writeGlobalHookState(tempDir, { includeSessionState: false });

		const { deps, execCount, spawnCount, capturedExecCmd } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		await promptKitUpdate(false, true, deps);

		expect(execCount()).toBe(1);
		expect(spawnCount()).toBe(0);
		expect(capturedExecCmd()).toContain("ck init -g");
		expect(capturedExecCmd()).toContain("--restore-ck-hooks");
	});

	test("does not force global hook restore for hooks explicitly disabled in .ck.json", async () => {
		await writeGlobalHookState(tempDir, {
			disabled: { "session-state": false },
			includeSessionState: false,
		});

		const { deps, execCount, capturedExecCmd } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		await promptKitUpdate(false, true, deps);

		expect(execCount()).toBe(1);
		expect(capturedExecCmd()).toContain("ck init -g");
		expect(capturedExecCmd()).not.toContain("--restore-ck-hooks");
	});

	test("reinstalls local kit when latest project settings have broken hook registrations (--yes mode)", async () => {
		const projectDir = join(tempDir, "project");
		const localClaudeDir = join(projectDir, ".claude");
		await mkdir(localClaudeDir, { recursive: true });
		await writeMetadata(localClaudeDir);

		const { deps, execCount, spawnCount, capturedExecCmd } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.getSetupFn = async () => ({
			global: {
				path: tempDir,
				metadata: {
					version: "1.0.0",
					name: "ClaudeKit",
					description: "test install",
					kits: { engineer: { version: "1.0.0" } },
				},
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
			project: {
				path: localClaudeDir,
				metadata: {
					version: "1.0.0",
					name: "ClaudeKit",
					description: "test project install",
					kits: { engineer: { version: "1.0.0" } },
				},
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
		});
		deps.countMissingHookFileReferencesFn = async (checkedProjectDir) => {
			expect(checkedProjectDir).toBe(projectDir);
			return 1;
		};

		await promptKitUpdate(false, true, deps);

		expect(execCount()).toBe(1);
		expect(spawnCount()).toBe(0);
		expect(capturedExecCmd()).toContain("ck init");
		expect(capturedExecCmd()).not.toContain("-g");
		expect(capturedExecCmd()).toContain("--yes");
		expect(capturedExecCmd()).toContain("--kit engineer");
	});

	test("prefers local hook self-heal over global kit update when both are installed (--yes mode)", async () => {
		const projectDir = join(tempDir, "project");
		const localClaudeDir = join(projectDir, ".claude");
		await mkdir(localClaudeDir, { recursive: true });
		await writeMetadata(localClaudeDir);

		const { deps, execCount, spawnCount, capturedExecCmd } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		deps.getSetupFn = async () => ({
			global: {
				path: tempDir,
				metadata: {
					version: "1.0.0",
					name: "ClaudeKit",
					description: "test install",
					kits: { engineer: { version: "1.0.0" } },
				},
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
			project: {
				path: localClaudeDir,
				metadata: {
					version: "1.0.0",
					name: "ClaudeKit",
					description: "test project install",
					kits: { engineer: { version: "1.0.0" } },
				},
				components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
			},
		});
		deps.countMissingHookFileReferencesFn = async (checkedProjectDir) => {
			expect(checkedProjectDir).toBe(projectDir);
			return 1;
		};

		await promptKitUpdate(true, true, deps);

		expect(execCount()).toBe(1);
		expect(spawnCount()).toBe(0);
		expect(capturedExecCmd()).toContain("ck init");
		expect(capturedExecCmd()).not.toContain("-g");
		expect(capturedExecCmd()).toContain("--yes");
		expect(capturedExecCmd()).toContain("--kit engineer");
		expect(capturedExecCmd()).toContain("--restore-ck-hooks");
		expect(capturedExecCmd()).toContain("--beta");
	});

	test("interactive mode passes --beta when installed version is prerelease", async () => {
		await writeMetadata(tempDir, "2.15.1-beta.3");
		const { deps, capturedSpawnArgs } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).toContain("--beta");
	});

	test("-y mode passes --beta when beta flag is set", async () => {
		const { deps, capturedExecCmd } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		await promptKitUpdate(true, true, deps);
		expect(capturedExecCmd()).toContain("--beta");
	});
});
