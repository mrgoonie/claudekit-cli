import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PromptKitUpdateDeps } from "@/commands/update-cli.js";
import { promptKitUpdate } from "@/commands/update-cli.js";
import { countMissingCkHookRegistrations } from "@/commands/update/post-update-handler.js";
import type { InstallModeReport } from "@/domains/installation/plugin/install-mode-detector.js";

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

async function writeMetadata(
	dir: string,
	version = "1.0.0",
	installModePreference?: "auto" | "plugin" | "legacy",
) {
	await writeFile(
		join(dir, "metadata.json"),
		JSON.stringify({
			version: "1.0.0",
			kits: {
				engineer: {
					version,
					installedAt: "2025-01-01T00:00:00Z",
					...(installModePreference ? { installModePreference } : {}),
				},
			},
		}),
	);
}

function makeInstallModeReport(
	claudeDir: string,
	mode: InstallModeReport["mode"],
): InstallModeReport {
	return {
		mode,
		claudeDir,
		plugin: {
			installed: mode === "plugin" || mode === "mixed",
			enabled: mode === "plugin" || mode === "mixed",
			version: mode === "plugin" || mode === "mixed" ? "v1.0.0" : null,
			marketplace: mode === "plugin" || mode === "mixed" ? "claudekit" : null,
			staleCache: false,
		},
		legacy: {
			installed: mode === "legacy" || mode === "mixed",
			version: mode === "legacy" || mode === "mixed" ? "v1.0.0" : null,
		},
	};
}

async function writeGlobalHookState(
	dir: string,
	options: {
		disabled?: Record<string, boolean>;
		includeSessionState?: boolean;
		projectScopedCommands?: boolean;
	} = {},
) {
	const commandFor = (name: string) =>
		options.projectScopedCommands
			? `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/${name}.cjs`
			: `node "$HOME/.claude/hooks/${name}.cjs"`;
	const hooks = [{ type: "command", command: commandFor("simplify-gate") }];
	if (options.includeSessionState) {
		hooks.push({ type: "command", command: commandFor("session-state") });
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
		JSON.stringify({ hooks: options.disabled ?? {} }, null, 2),
	);

	// Kit-shipped managed-hooks manifest (deterministic source of truth) plus the
	// hook files it references — both required by the detector.
	const hooksDir = join(dir, "hooks");
	await mkdir(hooksDir, { recursive: true });
	await writeFile(
		join(hooksDir, "managed-hooks.json"),
		JSON.stringify({ managedHooks: ["simplify-gate", "session-state"] }),
	);
	await writeFile(join(hooksDir, "simplify-gate.cjs"), "// stub\n");
	await writeFile(join(hooksDir, "session-state.cjs"), "// stub\n");
}

describe("promptKitUpdate auto-init behavior", () => {
	let tempDir: string;
	// Isolated empty home so hook self-heal checks never read the developer's real
	// global ~/.claude (which has CK hooks installed). Without this, version-skip
	// tests reinstall on a dev machine but pass in CI where ~/.claude is empty.
	let testHome: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-auto-init-"));
		testHome = await mkdtemp(join(tmpdir(), "ck-auto-init-home-"));
		await mkdir(join(testHome, ".claude"), { recursive: true });
		process.env.CK_TEST_HOME = testHome;
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
		await rm(testHome, { recursive: true, force: true });
		Reflect.deleteProperty(process.env, "CK_TEST_HOME");
	});

	/** Create test deps with exec mock (for migrate/update commands) and spawn mock (for ck init) */
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
			detectInstallModeFn: () => makeInstallModeReport(tempDir, "plugin"),
			hasTrackedPluginSuppliedLegacyFilesFn: () => false,
			shouldRefreshCodexPluginFn: async () => false,
			detectCodexPluginStateFn: async () => ({
				status: "missing",
				pluginId: "ck@claudekit",
				enabled: false,
				installed: false,
				installedVersion: null,
				expectedVersion: null,
				marketplace: null,
				expectedMarketplace: "claudekit",
				source: null,
				expectedSource: null,
				shouldRefresh: true,
			}),
			cleanupStaleCodexConfigEntriesFn: async () => [],
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
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).not.toContain("--yes");
	});

	test("interactive update passes the normal install mode when consent is missing", async () => {
		const { deps, capturedSpawnArgs } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).toContain("--install-mode");
		expect(capturedSpawnArgs()).toContain("legacy");
	});

	test("interactive mode passes detected package manager to ck init", async () => {
		const { deps, capturedSpawnArgs } = makeDeps();
		deps.skillsPackageManager = "bun";
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).toContain("--package-manager");
		expect(capturedSpawnArgs()).toContain("bun");
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

	test("autoInitAfterUpdate does not pass --yes but uses normal mode without consent", async () => {
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		const { deps, capturedSpawnArgs } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).not.toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).toContain("--install-mode");
		expect(capturedSpawnArgs()).toContain("legacy");
		expect(capturedSpawnArgs()).toContain("--install-skills");
	});

	// --- Non-interactive mode (spawn) tests ---

	test("explicit -y flag uses spawn with inherited stdio, --yes, and --kit", async () => {
		const { deps, capturedSpawnArgs, execCount, spawnCount } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		await promptKitUpdate(false, true, deps);
		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).toContain("-g");
		expect(capturedSpawnArgs()).toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).toContain("--install-skills");
	});

	test("-y flag overrides autoInit: uses non-interactive spawn even when autoInitAfterUpdate is enabled", async () => {
		// When both -y and autoInit are set, -y wins: fully non-interactive via spawn.
		// autoInit only matters when yes=false; with yes=true, ck init inherits stdio
		// while still receiving --yes and the detected kit.
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);
		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
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
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "legacy");
		await promptKitUpdate(false, true, deps);
		expect(execCount()).toBe(0);
		expect(spawnCount()).toBe(0);
	});

	test("reinstalls latest global engineer kit when Codex plugin is missing (--yes mode)", async () => {
		await writeMetadata(tempDir, "1.0.0", "plugin");
		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.shouldRefreshCodexPluginFn = async () => true;

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).toContain("-g");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
		expect(capturedSpawnArgs()).toContain("plugin");
	});

	test("cleans Codex config before checking stable plugin source (--yes mode)", async () => {
		await writeMetadata(tempDir, "1.0.0", "plugin");
		const { deps, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		let cleanupRan = false;
		let refreshOptions: unknown;
		deps.cleanupStaleCodexConfigEntriesFn = async () => {
			cleanupRan = true;
			return ["fullstack_developer"];
		};
		deps.shouldRefreshCodexPluginFn = async (options) => {
			expect(cleanupRan).toBe(true);
			refreshOptions = options;
			return true;
		};

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
		expect(refreshOptions).toMatchObject({
			expectedVersion: "1.0.0",
			expectedSource: join(testHome, ".cache", "claude", "ck-plugin-source", ".claude"),
		});
	});

	test("missing preference converges an observed plugin install to normal without Codex refresh", async () => {
		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "plugin");
		let codexRefreshChecks = 0;
		deps.shouldRefreshCodexPluginFn = async () => {
			codexRefreshChecks++;
			return true;
		};

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).toContain("-g");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
		expect(capturedSpawnArgs()).toContain("--install-mode");
		expect(capturedSpawnArgs()).toContain("legacy");
		expect(codexRefreshChecks).toBe(0);
	});

	test("normal preference converges Codex-only plugin state", async () => {
		const { deps, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "legacy");
		deps.detectCodexPluginStateFn = async () => ({
			status: "installed-current",
			pluginId: "ck@claudekit",
			enabled: true,
			installed: true,
			installedVersion: "1.0.0",
			expectedVersion: null,
			marketplace: "claudekit",
			expectedMarketplace: "claudekit",
			source: null,
			expectedSource: null,
			shouldRefresh: false,
		});

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
		expect(capturedSpawnArgs()).toContain("legacy");
	});

	test("historical auto preference converges to normal and skips plugin health probing", async () => {
		await writeMetadata(tempDir, "1.0.0", "auto");
		const { deps, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "plugin");
		let codexRefreshChecks = 0;
		deps.shouldRefreshCodexPluginFn = async () => {
			codexRefreshChecks++;
			return true;
		};

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(capturedSpawnArgs()).toContain("legacy");
		expect(codexRefreshChecks).toBe(0);
	});

	test("malformed preference converges to normal", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "1.0.0",
						installedAt: "2025-01-01T00:00:00Z",
						installModePreference: "unexpected",
					},
				},
			}),
		);
		const { deps, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "plugin");

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(capturedSpawnArgs()).toContain("legacy");
	});

	test("preserves explicit legacy preference and skips same-version plugin migration", async () => {
		await writeMetadata(tempDir, "1.0.0", "legacy");
		const { deps, execCount, spawnCount } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "legacy");
		deps.hasTrackedPluginSuppliedLegacyFilesFn = () => true;

		await promptKitUpdate(false, true, deps);

		expect(execCount()).toBe(0);
		expect(spawnCount()).toBe(0);
	});

	test("passes explicit legacy preference through version updates without plugin self-heal", async () => {
		await writeMetadata(tempDir, "1.0.0", "legacy");
		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "legacy");
		deps.hasTrackedPluginSuppliedLegacyFilesFn = () => true;

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("--install-mode");
		expect(capturedSpawnArgs()).toContain("legacy");
		expect(capturedSpawnArgs()).not.toContain("--restore-ck-hooks");
	});

	test("strict plugin preference propagates failed non-interactive init", async () => {
		await writeMetadata(tempDir, "1.0.0", "plugin");
		const { deps } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		deps.spawnInitFn = async () => 1;

		await expect(promptKitUpdate(false, true, deps)).rejects.toThrow(
			"Strict plugin kit update failed with exit code 1",
		);
	});

	test("strict plugin preference propagates failed interactive init", async () => {
		await writeMetadata(tempDir, "1.0.0", "plugin");
		const { deps } = makeDeps();
		deps.spawnInitFn = async () => 1;

		await expect(promptKitUpdate(false, false, deps)).rejects.toThrow(
			"Strict plugin kit update failed with exit code 1",
		);
	});

	test("reinstalls latest mixed install only when plugin-supplied legacy files remain", async () => {
		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "mixed");
		deps.hasTrackedPluginSuppliedLegacyFilesFn = () => true;

		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
	});

	test("normal preference cleans an active mixed install after tracked legacy files are gone", async () => {
		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "mixed");
		deps.hasTrackedPluginSuppliedLegacyFilesFn = () => false;

		await promptKitUpdate(false, true, deps);

		expect(execCount()).toBe(0);
		expect(spawnCount()).toBe(1);
		expect(capturedSpawnArgs()).toContain("legacy");
	});

	test("reinstalls latest kit when installed hooks have missing dependencies (--yes mode)", async () => {
		const hooksDir = join(tempDir, "hooks");
		await mkdir(hooksDir, { recursive: true });
		await writeFile(
			join(hooksDir, "usage-context-awareness.cjs"),
			"const quota = require('./usage-quota-cache-refresh.cjs');\nconsole.log(quota);\n",
		);

		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);
		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
	});

	test("restores missing global hook registrations during a kit update (--yes mode)", async () => {
		await writeGlobalHookState(tempDir, { includeSessionState: false });

		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "legacy");
		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).toContain("-g");
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
	});

	test("restores global hook registrations that point at CLAUDE_PROJECT_DIR (--yes mode)", async () => {
		await writeGlobalHookState(tempDir, {
			includeSessionState: true,
			projectScopedCommands: true,
		});

		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).toContain("-g");
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
	});

	test("does not force global hook restore for hooks explicitly disabled in .ck.json", async () => {
		await writeGlobalHookState(tempDir, {
			disabled: { "session-state": false },
			includeSessionState: false,
		});

		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		deps.detectInstallModeFn = () => makeInstallModeReport(tempDir, "legacy");
		await promptKitUpdate(false, true, deps);

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).toContain("-g");
		expect(capturedSpawnArgs()).not.toContain("--restore-ck-hooks");
	});

	// Helpers for the kit-shipped managed-hooks manifest model.
	async function writeManagedHooksManifest(dir: string, names: string[]) {
		const hooksDir = join(dir, "hooks");
		await mkdir(hooksDir, { recursive: true });
		await writeFile(join(hooksDir, "managed-hooks.json"), JSON.stringify({ managedHooks: names }));
		// existsSync(<name>.cjs) gates counting — create a file per managed hook.
		for (const name of names) {
			await writeFile(join(hooksDir, `${name}.cjs`), "// stub\n");
		}
	}

	async function writeLiveHooks(dir: string, names: string[]) {
		const hooks = names.map((name) => ({
			type: "command",
			command: `node "$HOME/.claude/hooks/${name}.cjs"`,
		}));
		await writeFile(
			join(dir, "settings.json"),
			JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks }] } }, null, 2),
		);
	}

	async function writeDisabledHooks(dir: string, disabled: Record<string, boolean>) {
		await writeFile(join(dir, ".ck.json"), JSON.stringify({ hooks: disabled }, null, 2));
	}

	test("reproduces real-world drift: team hooks + disabled hooks yield zero missing", async () => {
		// 11 template (managed) hooks shipped by the kit.
		const managed = [
			"cook-after-plan-reminder",
			"descriptive-name",
			"dev-rules-reminder",
			"plan-format-kanban",
			"privacy-block",
			"scout-block",
			"session-init",
			"session-state",
			"simplify-gate",
			"subagent-init",
			"usage-quota-cache-refresh",
		];
		await writeManagedHooksManifest(tempDir, managed);
		// settings.json has the 9 enabled hooks (privacy-block + scout-block disabled).
		await writeLiveHooks(
			tempDir,
			managed.filter((n) => n !== "privacy-block" && n !== "scout-block"),
		);
		await writeDisabledHooks(tempDir, { "privacy-block": false, "scout-block": false });
		// Team hooks exist on disk but are NOT in the manifest — must never be flagged.
		await writeFile(join(tempDir, "hooks", "task-completed-handler.cjs"), "// stub\n");
		await writeFile(join(tempDir, "hooks", "teammate-idle-handler.cjs"), "// stub\n");

		await expect(countMissingCkHookRegistrations(tempDir, "engineer")).resolves.toBe(0);
	});

	test("counts a managed hook genuinely missing from settings.json", async () => {
		await writeManagedHooksManifest(tempDir, ["session-init", "post-edit-simplify-reminder"]);
		await writeLiveHooks(tempDir, ["session-init"]); // post-edit-simplify-reminder absent
		await writeDisabledHooks(tempDir, {});

		await expect(countMissingCkHookRegistrations(tempDir, "engineer")).resolves.toBe(1);
	});

	test("counts global managed hooks registered with project-scoped roots as missing", async () => {
		await writeManagedHooksManifest(tempDir, ["session-init"]);
		await writeFile(
			join(tempDir, "settings.json"),
			JSON.stringify(
				{
					hooks: {
						UserPromptSubmit: [
							{
								hooks: [
									{
										type: "command",
										command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/session-init.cjs',
									},
								],
							},
						],
					},
				},
				null,
				2,
			),
		);
		await writeDisabledHooks(tempDir, {});

		await expect(
			countMissingCkHookRegistrations(tempDir, "engineer", { isGlobal: true }),
		).resolves.toBe(1);
		await expect(
			countMissingCkHookRegistrations(tempDir, "engineer", { isGlobal: false }),
		).resolves.toBe(0);
	});

	test("does not count an explicitly disabled managed hook", async () => {
		await writeManagedHooksManifest(tempDir, ["session-init", "privacy-block"]);
		await writeLiveHooks(tempDir, ["session-init"]); // privacy-block absent but disabled
		await writeDisabledHooks(tempDir, { "privacy-block": false });

		await expect(countMissingCkHookRegistrations(tempDir, "engineer")).resolves.toBe(0);
	});

	test("does not count a managed hook whose file the kit no longer ships", async () => {
		await writeManagedHooksManifest(tempDir, ["session-init"]);
		await writeLiveHooks(tempDir, []); // session-init absent from settings
		await writeDisabledHooks(tempDir, {});
		// Remove the hook file to simulate the kit dropping it.
		await rm(join(tempDir, "hooks", "session-init.cjs"));

		await expect(countMissingCkHookRegistrations(tempDir, "engineer")).resolves.toBe(0);
	});

	test("returns 0 when no managed-hooks manifest is present (older install)", async () => {
		await writeLiveHooks(tempDir, ["session-init"]);
		await writeDisabledHooks(tempDir, {});
		// No hooks/managed-hooks.json — self-heal stays silent, no false positive.

		await expect(countMissingCkHookRegistrations(tempDir, "engineer")).resolves.toBe(0);
	});

	test("converges: once the missing hook is registered, re-detection is zero", async () => {
		await writeManagedHooksManifest(tempDir, ["session-init", "session-state"]);
		await writeLiveHooks(tempDir, ["session-init"]);
		await writeDisabledHooks(tempDir, {});
		await expect(countMissingCkHookRegistrations(tempDir, "engineer")).resolves.toBe(1);

		// Simulate restore adding the missing hook to settings.json.
		await writeLiveHooks(tempDir, ["session-init", "session-state"]);
		await expect(countMissingCkHookRegistrations(tempDir, "engineer")).resolves.toBe(0);
	});

	test("reinstalls local kit when latest project settings have broken hook registrations (--yes mode)", async () => {
		const projectDir = join(tempDir, "project");
		const localClaudeDir = join(projectDir, ".claude");
		await mkdir(localClaudeDir, { recursive: true });
		await writeMetadata(localClaudeDir);

		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
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

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).not.toContain("-g");
		expect(capturedSpawnArgs()).toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
	});

	test("prefers local hook self-heal over global kit update when both are installed (--yes mode)", async () => {
		const projectDir = join(tempDir, "project");
		const localClaudeDir = join(projectDir, ".claude");
		await mkdir(localClaudeDir, { recursive: true });
		await writeMetadata(localClaudeDir);

		const { deps, execCount, spawnCount, capturedSpawnArgs } = makeDeps();
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

		expect(spawnCount()).toBe(1);
		expect(execCount()).toBe(0);
		expect(capturedSpawnArgs()).toContain("init");
		expect(capturedSpawnArgs()).not.toContain("-g");
		expect(capturedSpawnArgs()).toContain("--yes");
		expect(capturedSpawnArgs()).toContain("--kit");
		expect(capturedSpawnArgs()).toContain("engineer");
		expect(capturedSpawnArgs()).toContain("--restore-ck-hooks");
		expect(capturedSpawnArgs()).toContain("--beta");
	});

	test("interactive mode passes --beta when installed version is prerelease", async () => {
		await writeMetadata(tempDir, "2.15.1-beta.3");
		const { deps, capturedSpawnArgs } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(capturedSpawnArgs()).toContain("--beta");
	});

	test("-y mode passes --beta when beta flag is set", async () => {
		const { deps, capturedSpawnArgs } = makeDeps();
		deps.getLatestReleaseTagFn = async () => "v2.0.0";
		await promptKitUpdate(true, true, deps);
		expect(capturedSpawnArgs()).toContain("--beta");
	});
});
