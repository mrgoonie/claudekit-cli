import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

	function makeDeps(execImpl?: () => Promise<void>) {
		let execCount = 0;
		const deps: PromptKitUpdateDeps = {
			execAsyncFn: async () => {
				execCount++;
				await execImpl?.();
				return { stdout: "", stderr: "" };
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
		return { deps, execCount: () => execCount };
	}

	test("skips confirmation when autoInitAfterUpdate is enabled", async () => {
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		confirmMock.mockImplementation(async () => {
			throw new Error("confirm should not be reached");
		});
		const { deps, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(confirmMock).not.toHaveBeenCalled();
		expect(loadFullConfigMock).toHaveBeenCalledWith(null);
		expect(execCount()).toBe(1);
	});

	test("prompts normally when autoInitAfterUpdate is disabled", async () => {
		const { deps, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
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
		await promptKitUpdate(false, false, deps);
		expect(execCount()).toBe(0);
	});

	test("falls back to the manual prompt when config loading fails", async () => {
		loadFullConfigMock.mockRejectedValue(new Error("config unavailable"));
		const { deps, execCount } = makeDeps();
		await promptKitUpdate(false, false, deps);
		expect(confirmMock).toHaveBeenCalledTimes(1);
		expect(execCount()).toBe(1);
	});

	test("runs init when kit is at latest but autoInitAfterUpdate is enabled (--yes mode)", async () => {
		loadFullConfigMock.mockResolvedValue({
			config: { updatePipeline: { autoInitAfterUpdate: true } },
		});
		const { deps, execCount } = makeDeps();
		// Return matching version so kit is "at latest"
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);
		expect(execCount()).toBe(1);
	});

	test("skips init when kit is at latest and autoInitAfterUpdate is disabled (--yes mode)", async () => {
		const { deps, execCount } = makeDeps();
		// Return matching version so kit is "at latest"
		deps.getLatestReleaseTagFn = async () => "v1.0.0";
		await promptKitUpdate(false, true, deps);
		expect(execCount()).toBe(0);
	});
});
