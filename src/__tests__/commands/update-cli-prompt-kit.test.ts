/**
 * Tests for promptKitUpdate version display and skip-if-same-version logic.
 * Uses ONLY dependency injection — zero mock.module() to avoid cross-file contamination.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PromptKitUpdateDeps } from "@/commands/update-cli.js";
import { promptKitUpdate } from "@/commands/update-cli.js";
import { versionsMatch } from "@/domains/versioning/checking/version-utils.js";

describe("promptKitUpdate version display", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-prompt-kit-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	/** Build deps with injectable exec side-effect and spinner capture */
	function makeDeps(opts?: {
		sideEffect?: () => void | Promise<void>;
		latestTag?: string | null;
	}) {
		const stopCalls: string[] = [];
		let execCalled = false;
		const deps: PromptKitUpdateDeps = {
			execAsyncFn: async () => {
				execCalled = true;
				if (opts?.sideEffect) await opts.sideEffect();
				return { stdout: "", stderr: "" };
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
		};
		return { deps, stopCalls, wasExecCalled: () => execCalled };
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

		await promptKitUpdate(false, true, deps);

		const stopMsg = stopCalls.find((m) => m.includes("->"));
		expect(stopMsg).toBeDefined();
		expect(stopMsg).toContain("1.0.0");
		expect(stopMsg).toContain("2.0.0");
		expect(stopMsg).toContain("engineer");
	});

	it("skips update entirely when latest tag matches installed version", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, stopCalls, wasExecCalled } = makeDeps({ latestTag: "v1.0.0" });

		await promptKitUpdate(false, true, deps);

		// Init command should NOT have been called
		expect(wasExecCalled()).toBe(false);
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
		expect(depsWithPrefix.wasExecCalled()).toBe(false);
	});

	it("proceeds normally when latest tag fetch fails (returns null)", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, wasExecCalled } = makeDeps({ latestTag: null });

		await promptKitUpdate(false, true, deps);

		// Should still call exec since version check was inconclusive
		expect(wasExecCalled()).toBe(true);
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

		await promptKitUpdate(false, true, deps);

		const stopMsg = stopCalls[stopCalls.length - 1];
		expect(stopMsg).toBe("Kit content updated");
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
