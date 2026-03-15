/**
 * Tests for promptKitUpdate version display branches.
 * Uses ONLY dependency injection — zero mock.module() to avoid cross-file contamination.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PromptKitUpdateDeps } from "@/commands/update-cli.js";
import { promptKitUpdate } from "@/commands/update-cli.js";

describe("promptKitUpdate version display", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "ck-prompt-kit-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	/** Build deps with injectable exec side-effect and spinner capture */
	function makeDeps(sideEffect?: () => void | Promise<void>) {
		const stopCalls: string[] = [];
		const deps: PromptKitUpdateDeps = {
			execAsyncFn: async () => {
				if (sideEffect) await sideEffect();
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
		};
		return { deps, stopCalls };
	}

	it("shows version transition when kit version changed after init", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, stopCalls } = makeDeps(async () => {
			await writeFile(
				join(tempDir, "metadata.json"),
				JSON.stringify({
					version: "1.0.0",
					kits: { engineer: { version: "2.0.0", installedAt: "2025-01-01T00:00:00Z" } },
				}),
			);
		});

		await promptKitUpdate(false, true, deps);

		const stopMsg = stopCalls.find((m) => m.includes("->"));
		expect(stopMsg).toBeDefined();
		expect(stopMsg).toContain("1.0.0");
		expect(stopMsg).toContain("2.0.0");
		expect(stopMsg).toContain("engineer");
	});

	it("shows confirmation message when kit version unchanged", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, stopCalls } = makeDeps();

		await promptKitUpdate(false, true, deps);

		const stopMsg = stopCalls[stopCalls.length - 1];
		expect(stopMsg).toBeDefined();
		expect(stopMsg).not.toContain("->");
		expect(stopMsg).toContain("engineer@1.0.0");
	});

	it("falls back to generic message when post-init metadata is unreadable", async () => {
		await writeFile(
			join(tempDir, "metadata.json"),
			JSON.stringify({
				version: "1.0.0",
				kits: { engineer: { version: "1.0.0", installedAt: "2025-01-01T00:00:00Z" } },
			}),
		);

		const { deps, stopCalls } = makeDeps(async () => {
			await rm(join(tempDir, "metadata.json"), { force: true });
		});

		await promptKitUpdate(false, true, deps);

		const stopMsg = stopCalls[stopCalls.length - 1];
		expect(stopMsg).toBe("Kit content updated");
	});
});
