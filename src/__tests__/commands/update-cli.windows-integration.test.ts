/**
 * Windows-focused integration-style test for update-cli command behavior.
 *
 * Simulates a real-world mismatch where package manager update succeeds but
 * active `ck` still resolves to an older version in PATH.
 */
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { promisify } from "node:util";

const actualChildProcess = await import("node:child_process");

const execMock = mock((command: string, optionsOrCallback: unknown, maybeCallback?: unknown) => {
	const callback =
		typeof optionsOrCallback === "function"
			? (optionsOrCallback as (err: unknown, stdout?: string, stderr?: string) => void)
			: (maybeCallback as (err: unknown, stdout?: string, stderr?: string) => void);

	if (typeof callback !== "function") {
		throw new Error(`exec mock expected callback for command: ${command}`);
	}

	if (command.startsWith("npm install -g claudekit-cli@")) {
		queueMicrotask(() => callback(null, "", ""));
		return { pid: 1111, kill: () => {} } as unknown;
	}

	if (command === "ck --version") {
		queueMicrotask(() =>
			callback(null, "CLI Version: 3.34.0\nGlobal Kit Version: engineer@v2.12.0", ""),
		);
		return { pid: 2222, kill: () => {} } as unknown;
	}

	queueMicrotask(() => callback(new Error(`Unexpected command in test: ${command}`)));
	return { pid: 3333, kill: () => {} } as unknown;
});

(execMock as unknown as { [key: symbol]: unknown })[promisify.custom] = (
	command: string,
	options?: unknown,
) =>
	new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		execMock(command, options, (error: unknown, stdout?: string, stderr?: string) => {
			if (error) {
				reject(error);
				return;
			}
			resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
		});
	});

mock.module("node:child_process", () => ({
	...actualChildProcess,
	exec: execMock,
}));

const packageManagerDetectorMock = {
	detect: mock(async () => "npm"),
	getVersion: mock(async () => "10.9.0"),
	getDisplayName: mock(() => "npm"),
	getNpmRegistryUrl: mock(async () => null),
	getUpdateCommand: mock(() => "npm install -g claudekit-cli@3.34.5"),
};

mock.module("@/domains/installation/package-manager-detector.js", () => ({
	PackageManagerDetector: packageManagerDetectorMock,
}));

const npmRegistryClientMock = {
	versionExists: mock(async () => true),
	getLatestVersion: mock(async () => "3.34.5"),
	getDevVersion: mock(async () => null),
};

mock.module("@/domains/github/npm-registry.js", () => ({
	NpmRegistryClient: npmRegistryClientMock,
	redactRegistryUrlForLog: (url: string) => url,
}));

const spinnerStartMock = mock(() => {});
const spinnerStopMock = mock(() => {});
const introMock = mock(() => {});
const outroMock = mock(() => {});

mock.module("@/shared/safe-prompts.js", () => ({
	confirm: mock(async () => true),
	intro: introMock,
	isCancel: () => false,
	log: {
		info: mock(() => {}),
	},
	note: mock(() => {}),
	outro: outroMock,
	spinner: () => ({
		start: spinnerStartMock,
		stop: spinnerStopMock,
	}),
}));

const loggerErrorMock = mock(() => {});
const loggerInfoMock = mock(() => {});
const loggerWarningMock = mock(() => {});
const loggerVerboseMock = mock(() => {});
const loggerDebugMock = mock(() => {});
const loggerSuccessMock = mock(() => {});

mock.module("@/shared/logger.js", () => ({
	logger: {
		error: loggerErrorMock,
		info: loggerInfoMock,
		warning: loggerWarningMock,
		verbose: loggerVerboseMock,
		debug: loggerDebugMock,
		success: loggerSuccessMock,
	},
}));

const { updateCliCommand, CliUpdateError } = await import("@/commands/update-cli.js");

describe("update-cli windows integration behavior", () => {
	beforeEach(() => {
		execMock.mockClear();
		packageManagerDetectorMock.detect.mockClear();
		packageManagerDetectorMock.getVersion.mockClear();
		packageManagerDetectorMock.getDisplayName.mockClear();
		packageManagerDetectorMock.getNpmRegistryUrl.mockClear();
		packageManagerDetectorMock.getUpdateCommand.mockClear();
		npmRegistryClientMock.versionExists.mockClear();
		npmRegistryClientMock.getLatestVersion.mockClear();
		npmRegistryClientMock.getDevVersion.mockClear();
		spinnerStartMock.mockClear();
		spinnerStopMock.mockClear();
		introMock.mockClear();
		outroMock.mockClear();
		loggerErrorMock.mockClear();
		loggerInfoMock.mockClear();
		loggerWarningMock.mockClear();
		loggerVerboseMock.mockClear();
		loggerDebugMock.mockClear();
		loggerSuccessMock.mockClear();
	});

	afterAll(() => {
		mock.restore();
	});

	it("throws mismatch error with Windows `where ck` guidance when active version remains old", async () => {
		const options = {
			release: "3.34.5",
			check: false,
			yes: true,
			dev: false,
			beta: false,
			verbose: false,
			json: false,
		};

		try {
			await updateCliCommand(options);
			throw new Error("Expected updateCliCommand to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(CliUpdateError);
			const message = error instanceof Error ? error.message : String(error);
			expect(message).toContain("Update did not activate the requested version.");
			expect(message).toContain("Expected: 3.34.5");
			expect(message).toContain("Active ck: 3.34.0");
			expect(message).toContain("Windows: where ck");
		}

		expect(execMock).toHaveBeenCalledWith(
			"npm install -g claudekit-cli@3.34.5",
			expect.any(Object),
			expect.any(Function),
		);
		expect(execMock).toHaveBeenCalledWith("ck --version", expect.any(Object), expect.any(Function));
	});
});
