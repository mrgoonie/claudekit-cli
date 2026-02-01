/**
 * Integration test for --yes flag in promptKitUpdate.
 * Verifies confirm() is NOT called when yes=true and IS called when yes=false.
 *
 * Uses mock.module so MUST be in its own file to avoid pollution.
 * Run standalone: bun test tests/commands/update-cli-yes-flag-integration.test.ts
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";

// Track whether confirm was called
const mockConfirm = mock(async () => true);
const mockIsCancel = mock((_v: unknown) => false);
const mockLogInfo = mock(() => {});
const mockSpinnerStart = mock((_msg: string) => {});
const mockSpinnerStop = mock((_msg?: string) => {});
const mockLoggerInfo = mock((_msg: string) => {});
const mockLoggerVerbose = mock((_msg: string) => {});
const mockLoggerWarning = mock((_msg: string) => {});
const mockLoggerError = mock((_msg: string) => {});
const mockExecAsync = mock(async (_cmd: string, _opts?: unknown) => ({
	stdout: "",
	stderr: "",
}));

const mockGetClaudeKitSetup = mock(async () => ({
	project: {
		path: "/tmp/nonexistent/.claude",
		metadata: null as null | Record<string, unknown>,
	},
	global: {
		path: "/tmp/nonexistent-global/.claude",
		metadata: { version: "1.0.0" } as null | Record<string, unknown>,
	},
}));

mock.module("@/shared/safe-prompts.js", () => ({
	confirm: mockConfirm,
	isCancel: mockIsCancel,
	log: { info: mockLogInfo },
	spinner: mock(() => ({ start: mockSpinnerStart, stop: mockSpinnerStop })),
	intro: mock(() => {}),
	outro: mock(() => {}),
	note: mock(() => {}),
}));

mock.module("@/shared/logger.js", () => ({
	logger: {
		info: mockLoggerInfo,
		verbose: mockLoggerVerbose,
		warning: mockLoggerWarning,
		error: mockLoggerError,
	},
}));

mock.module("@/services/file-operations/claudekit-scanner.js", () => ({
	getClaudeKitSetup: mockGetClaudeKitSetup,
}));

mock.module("@/domains/migration/metadata-migration.js", () => ({
	getInstalledKits: mock(() => []),
}));

mock.module("node:child_process", () => ({ exec: () => {} }));
mock.module("node:util", () => ({ promisify: () => mockExecAsync }));

const { promptKitUpdate } = await import("@/commands/update-cli.js");

describe("promptKitUpdate integration (--yes flag)", () => {
	beforeEach(() => {
		mockConfirm.mockClear();
		mockExecAsync.mockClear();
		mockLoggerVerbose.mockClear();

		mockGetClaudeKitSetup.mockImplementation(async () => ({
			project: { path: "/tmp/nonexistent/.claude", metadata: null },
			global: { path: "/tmp/nonexistent-global/.claude", metadata: { version: "1.0.0" } },
		}));
		mockExecAsync.mockImplementation(async () => ({ stdout: "", stderr: "" }));
		mockConfirm.mockImplementation(async () => true);
		mockIsCancel.mockImplementation(() => false);
	});

	it("does not call confirm() when yes=true", async () => {
		await promptKitUpdate(false, true);
		expect(mockConfirm).not.toHaveBeenCalled();
	});

	it("calls confirm() when yes=false", async () => {
		await promptKitUpdate(false, false);
		expect(mockConfirm).toHaveBeenCalled();
	});

	it("calls confirm() when yes is omitted", async () => {
		await promptKitUpdate(false);
		expect(mockConfirm).toHaveBeenCalled();
	});

	it("auto-proceeds to exec when yes=true", async () => {
		await promptKitUpdate(false, true);
		expect(mockExecAsync).toHaveBeenCalled();
	});

	it("logs verbose message when auto-proceeding", async () => {
		await promptKitUpdate(false, true);
		expect(mockLoggerVerbose).toHaveBeenCalledWith("Auto-proceeding with kit update (--yes flag)");
	});

	it("skips exec when user declines and yes=false", async () => {
		mockConfirm.mockImplementation(async () => false);
		await promptKitUpdate(false, false);
		expect(mockExecAsync).not.toHaveBeenCalled();
	});
});
