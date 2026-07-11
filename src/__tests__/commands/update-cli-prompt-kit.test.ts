/**
 * Tests for promptKitUpdate version display and skip-if-same-version logic.
 * Uses ONLY dependency injection — zero mock.module() to avoid cross-file contamination.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PromptKitUpdateDeps } from "@/commands/update-cli.js";
import { promptKitUpdate } from "@/commands/update-cli.js";
import type { InstallModeReport } from "@/domains/installation/plugin/install-mode-detector.js";
import { versionsMatch } from "@/domains/versioning/checking/version-utils.js";

describe("promptKitUpdate version display", () => {
	let tempDir: string;
	// Isolated empty home so hook self-heal checks never read the developer's real
	// global ~/.claude (which has CK hooks installed). Without this, version-skip
	// tests reinstall on a dev machine but pass in CI where ~/.claude is empty.
	let testHome: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-prompt-kit-"));
		testHome = await mkdtemp(join(tmpdir(), "ck-prompt-kit-home-"));
		await mkdir(join(testHome, ".claude"), { recursive: true });
		process.env.CK_TEST_HOME = testHome;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		await rm(testHome, { recursive: true, force: true });
		Reflect.deleteProperty(process.env, "CK_TEST_HOME");
	});

	/** Build deps with injectable ck init side-effect and spinner capture */
	function makeDeps(opts?: {
		sideEffect?: () => void | Promise<void>;
		latestTag?: string | null;
		installMode?: InstallModeReport["mode"];
		hasTrackedPluginSuppliedLegacyFiles?: boolean;
	}) {
		const stopCalls: string[] = [];
		const installMode = opts?.installMode ?? "legacy";
		const hasLegacyInstall = installMode === "legacy" || installMode === "mixed";
		const hasPluginInstall = installMode === "plugin" || installMode === "mixed";
		const spawnArgs: string[][] = [];
		let spawnCalled = false;
		const deps: PromptKitUpdateDeps = {
			spawnInitFn: async (args) => {
				spawnCalled = true;
				spawnArgs.push(args);
				if (opts?.sideEffect) await opts.sideEffect();
				return 0;
			},
			getSetupFn: (async () => ({
				global: {
					path: tempDir,
					metadata: { kits: { engineer: { version: "1.0.0" } } },
					components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
				},
				project: {
					path: "",
					metadata: null,
					components: { commands: 0, hooks: 0, skills: 0, workflows: 0, settings: 0 },
				},
			})) as any,
			spinnerFn: (() => ({
				start: () => {},
				stop: (msg: string) => stopCalls.push(msg),
				message: "",
			})) as any,
			getLatestReleaseTagFn: async () => opts?.latestTag ?? null,
			loadFullConfigFn: async () => ({ config: { updatePipeline: undefined } }),
			detectInstallModeFn: () =>
				({
					mode: installMode,
					claudeDir: tempDir,
					plugin: {
						installed: hasPluginInstall,
						enabled: hasPluginInstall,
						version: hasPluginInstall ? "v1.0.0" : null,
						marketplace: "claudekit",
						staleCache: false,
					},
					legacy: {
						installed: hasLegacyInstall,
						version: hasLegacyInstall ? "1.0.0" : null,
					},
				}) satisfies InstallModeReport,
			hasTrackedPluginSuppliedLegacyFilesFn: () =>
				opts?.hasTrackedPluginSuppliedLegacyFiles ?? false,
			shouldRefreshCodexPluginFn: async () => false,
		};
		return { deps, stopCalls, spawnArgs, wasSpawnCalled: () => spawnCalled };
	}

	async function captureConsoleLog(fn: () => Promise<void>): Promise<string[]> {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		};
		try {
			await fn();
		} finally {
			console.log = originalLog;
		}
		return logs;
	}

	it("shows version transition when kit version changed after init", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, stopCalls } = makeDeps({
			latestTag: "v2.0.0",
			sideEffect: async () => {
				await writeFile(
					join(tempDir, "metadata.json"),
					JSON.stringify({
						version: "1.0.0",
						kits: { engineer: { version: "2.0.0", installedAt: "2025-01-01T00:00:00Z" } },
					}),
				);
			},
		});

		const logs = await captureConsoleLog(() => promptKitUpdate(false, true, deps));

		const successMsg = logs.find((m) => m.includes("Kit updated:"));
		expect(successMsg).toBeDefined();
		expect(successMsg).toContain("1.0.0");
		expect(successMsg).toContain("2.0.0");
		expect(successMsg).toContain("engineer");
		expect(stopCalls).toContain("Running ClaudeKit content update");
	});

	it("skips update entirely when latest tag matches installed version", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, stopCalls, wasSpawnCalled } = makeDeps({ latestTag: "v1.0.0" });

		await promptKitUpdate(false, true, deps);

		// Init command should NOT have been called
		expect(wasSpawnCalled()).toBe(false);
		// No spinner stop calls (skipped before spinner starts)
		expect(stopCalls.length).toBe(0);
	});

	it("skips update when versions match with v-prefix mismatch", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "v1.5.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		// Installed has v prefix, latest doesn't
		const depsWithPrefix = {
			...makeDeps({ latestTag: "1.5.0" }),
		};

		await promptKitUpdate(false, true, depsWithPrefix.deps);
		expect(depsWithPrefix.wasSpawnCalled()).toBe(false);
	});

	it("runs kit init for mixed plugin installs with tracked legacy skills even when version matches", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, spawnArgs, wasSpawnCalled } = makeDeps({
			latestTag: "v1.0.0",
			installMode: "mixed",
			hasTrackedPluginSuppliedLegacyFiles: true,
		});

		await promptKitUpdate(false, true, deps);

		expect(wasSpawnCalled()).toBe(true);
		expect(spawnArgs[0]).toContain("init");
		expect(spawnArgs[0]).toContain("-g");
		expect(spawnArgs[0]).toContain("--kit");
		expect(spawnArgs[0]).toContain("engineer");
		expect(spawnArgs[0]).toContain("--yes");
		expect(spawnArgs[0]).toContain("--restore-ck-hooks");
	});

	it("proceeds normally when latest tag fetch fails (returns null)", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, wasSpawnCalled } = makeDeps({ latestTag: null });

		await promptKitUpdate(false, true, deps);

		// Should still spawn ck init since version check was inconclusive
		expect(wasSpawnCalled()).toBe(true);
	});

	it("falls back to generic message when post-init metadata is unreadable", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, stopCalls } = makeDeps({
			latestTag: "v2.0.0",
			sideEffect: async () => {
				await rm(join(tempDir, "metadata.json"), { force: true });
			},
		});

		const logs = await captureConsoleLog(() => promptKitUpdate(false, true, deps));

		expect(logs.some((m) => m.includes("Kit content updated"))).toBe(true);
		expect(stopCalls).toContain("Running ClaudeKit content update");
	});
});

describe("versionsMatch", () => {
	it("matches identical versions", () => {
		expect(versionsMatch("1.0.0", "1.0.0")).toBe(true);
	});

	it("matches with v prefix on one side", () => {
		expect(versionsMatch("v1.0.0", "1.0.0")).toBe(true);
		expect(versionsMatch("1.0.0", "v1.0.0")).toBe(true);
	});

	it("matches with v prefix on both sides", () => {
		expect(versionsMatch("v2.3.0", "v2.3.0")).toBe(true);
	});

	it("does not match different versions", () => {
		expect(versionsMatch("1.0.0", "2.0.0")).toBe(false);
		expect(versionsMatch("v1.0.0", "v1.0.1")).toBe(false);
	});

	it("handles beta versions", () => {
		expect(versionsMatch("v1.0.0-beta.1", "v1.0.0-beta.1")).toBe(true);
		expect(versionsMatch("v1.0.0-beta.1", "v1.0.0")).toBe(false);
	});
});
