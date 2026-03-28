import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const confirmMock = mock(async (_options: { message: string }) => true as boolean | string);
const isCancelMock = mock((value: unknown) => value === "cancelled");
const loadFullMock = mock(
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

mock.module("@/shared/safe-prompts.js", () => ({
	confirm: (options: { message: string }) => confirmMock(options),
	isCancel: (value: unknown) => isCancelMock(value),
	intro: () => {},
	outro: () => {},
	note: () => {},
	spinner: () => ({ start: () => {}, stop: () => {}, message: "" }),
	log: { info: () => {}, success: () => {}, warning: () => {}, error: () => {} },
}));

mock.module("@/domains/config/ck-config-manager.js", () => ({
	CkConfigManager: {
		loadFull: (projectDir: string | null) => loadFullMock(projectDir),
	},
}));

const { promptKitUpdate } = await import("@/commands/update-cli.js");

async function writeMetadata(dir: string, version = "1.0.0") {
	await writeFile(
		join(dir, "metadata.json"),
		JSON.stringify({
			version: "1.0.0",
			kits: { engineer: { version, installedAt: "2025-01-01T00:00:00Z" } },
		}),
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
		loadFullMock.mockReset();
		loadFullMock.mockResolvedValue({ config: { updatePipeline: undefined } });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	afterAll(() => {
		mock.restore();
	});

	function makeDeps(execImpl?: () => Promise<void>) {
		let execCount = 0;
		return {
			execCount: () => execCount,
			deps: {
				execAsyncFn: async () => {
					execCount++;
					await execImpl?.();
					return { stdout: "", stderr: "" };
				},
				getSetupFn: async () => ({
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
				}),
				spinnerFn: () => ({ start: () => {}, stop: () => {}, message: "" }),
				getLatestReleaseTagFn: async () => null,
			},
		};
	}

	test("skips confirmation when autoInitAfterUpdate is enabled", async () => {
		loadFullMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		confirmMock.mockImplementation(async () => {
			throw new Error("confirm should not be reached");
		});
		const { deps, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps as any);
		expect(confirmMock).not.toHaveBeenCalled();
		expect(loadFullMock).toHaveBeenCalledWith(null);
		expect(execCount()).toBe(1);
	});

	test("prompts normally when autoInitAfterUpdate is disabled", async () => {
		const { deps, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps as any);
		expect(confirmMock).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining("Update global ClaudeKit content"),
			}),
		);
		expect(execCount()).toBe(1);
	});

	test("does not run init when the manual confirmation is declined", async () => {
		confirmMock.mockResolvedValue(false);
		const { deps, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps as any);
		expect(execCount()).toBe(0);
	});

	test("falls back to the manual prompt when config loading fails", async () => {
		loadFullMock.mockRejectedValue(new Error("config unavailable"));
		const { deps, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps as any);
		expect(confirmMock).toHaveBeenCalledTimes(1);
		expect(execCount()).toBe(1);
	});
});
