/**
 * Tests for plugin-installer.ts
 * Covers handlePluginInstall and handlePluginUninstall pipelines.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as childProcessActual from "node:child_process";
import * as fsPromisesActual from "node:fs/promises";
import * as utilActual from "node:util";
import * as fsExtraActual from "fs-extra";

// ---------------------------------------------------------------------------
// Mock all dependencies BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Track calls so we can configure per-test behavior
let mockExecFileImpl: (
	cmd: string,
	args: string[],
	opts?: unknown,
) => Promise<{ stdout: string; stderr: string }>;
mockExecFileImpl = () => Promise.resolve({ stdout: "", stderr: "" });
let useExecMocks = true;

const mockExecFileRaw = mock((...args: unknown[]) => {
	const [cmd, cmdArgs, opts] = args as [string, string[], unknown];
	return mockExecFileImpl(cmd, cmdArgs, opts);
});

// Mock node:child_process
mock.module("node:child_process", () => ({
	...childProcessActual,
	execFile: ((...args: unknown[]) => {
		if (!useExecMocks) {
			return (childProcessActual.execFile as unknown as (...inner: unknown[]) => unknown)(...args);
		}

		const [cmd, cmdArgs, opts, callback] = args as [
			string,
			string[],
			unknown,
			((error: Error | null, stdout: string, stderr: string) => void) | undefined,
		];
		const promise = mockExecFileImpl(cmd, cmdArgs, opts);
		if (typeof callback === "function") {
			void promise
				.then(({ stdout, stderr }) => callback(null, stdout, stderr))
				.catch((error) => callback(error as Error, "", ""));
			return {} as unknown;
		}
		return promise;
	}) as unknown as typeof childProcessActual.execFile,
}));

// Mock node:util — promisify must return our mock function
mock.module("node:util", () => ({
	...utilActual,
	promisify: ((fn: unknown) => {
		if (useExecMocks) {
			return mockExecFileRaw;
		}
		return utilActual.promisify(fn as Parameters<typeof utilActual.promisify>[0]);
	}) as typeof utilActual.promisify,
}));

// Mock node:fs/promises
let mockRenameImpl: (from: string, to: string) => Promise<void>;
mockRenameImpl = () => Promise.resolve();
let useFsPromisesMocks = false;
const mockRename = mock((from: string, to: string) => {
	if (!useFsPromisesMocks) {
		return fsPromisesActual.rename(from, to);
	}
	return mockRenameImpl(from, to);
});

mock.module("node:fs/promises", () => ({
	...fsPromisesActual,
	rename: mockRename,
}));

// Mock fs-extra
let mockPathExistsImpl: (p: string) => Promise<boolean>;
mockPathExistsImpl = () => Promise.resolve(true);
let useFsExtraMocks = false;

const mockPathExists = mock((p: string) =>
	useFsExtraMocks ? mockPathExistsImpl(p) : fsExtraActual.pathExists(p),
);
const mockCopy = mock((...args: Parameters<typeof fsExtraActual.copy>) =>
	useFsExtraMocks ? Promise.resolve() : fsExtraActual.copy(...args),
);
const mockRemove = mock((...args: Parameters<typeof fsExtraActual.remove>) =>
	useFsExtraMocks ? Promise.resolve() : fsExtraActual.remove(...args),
);
const mockEnsureDir = mock((...args: Parameters<typeof fsExtraActual.ensureDir>) =>
	useFsExtraMocks ? Promise.resolve() : fsExtraActual.ensureDir(...args),
);

mock.module("fs-extra", () => ({
	...fsExtraActual,
	pathExists: mockPathExists,
	copy: mockCopy,
	remove: mockRemove,
	ensureDir: mockEnsureDir,
}));

// Mock logger
mock.module("@/shared/logger.js", () => ({
	logger: {
		info: mock(() => {}),
		debug: mock(() => {}),
		verbose: mock(() => {}),
		warning: mock(() => {}),
		success: mock(() => {}),
		error: mock(() => {}),
	},
}));

// Mock exec options
mock.module("@/shared/claude-exec-options.js", () => ({
	buildExecOptions: (timeout: number) => ({ timeout, env: {}, shell: false }),
}));

// ---------------------------------------------------------------------------
// Import module under test (after all mocks are set up)
// ---------------------------------------------------------------------------
const { handlePluginInstall, handlePluginUninstall } = await import(
	"@/services/plugin-installer.js"
);
useExecMocks = false;

const originalCkTestHome = process.env.CK_TEST_HOME;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock execFile response factory.
 * Returns different values based on the args passed to execFile.
 */
function buildExecMock(config: {
	/** claude --version → success (CC available) */
	ccAvailable?: boolean;
	/** claude plugin marketplace list → lists marketplace */
	marketplaceList?: string;
	/** claude plugin marketplace add → success */
	marketplaceAdd?: boolean;
	/** claude plugin list → installed plugins */
	pluginList?: string;
	/** claude plugin install → success */
	pluginInstall?: boolean;
	/** claude plugin update → success */
	pluginUpdate?: boolean;
	/** claude plugin uninstall → success */
	pluginUninstall?: boolean;
	/** claude plugin marketplace remove → success */
	marketplaceRemove?: boolean;
}): typeof mockExecFileImpl {
	return (_cmd: string, args: string[]) => {
		// args[0] = "plugin" or "--version"
		if (args[0] === "--version") {
			if (config.ccAvailable === false) {
				return Promise.reject(new Error("command not found: claude"));
			}
			return Promise.resolve({ stdout: "1.0.35", stderr: "" });
		}

		// args[0] = "plugin", args[1] = subcommand
		const sub = args[1];

		if (sub === "marketplace") {
			const action = args[2];
			if (action === "list") {
				return Promise.resolve({ stdout: config.marketplaceList ?? "", stderr: "" });
			}
			if (action === "add") {
				if (config.marketplaceAdd === false) {
					return Promise.reject(new Error("marketplace add failed"));
				}
				return Promise.resolve({ stdout: "added", stderr: "" });
			}
			if (action === "remove") {
				if (config.marketplaceRemove === false) {
					return Promise.reject(new Error("marketplace remove failed"));
				}
				return Promise.resolve({ stdout: "removed", stderr: "" });
			}
		}

		if (sub === "list") {
			return Promise.resolve({ stdout: config.pluginList ?? "", stderr: "" });
		}

		if (sub === "install") {
			if (config.pluginInstall === false) {
				return Promise.reject(new Error("plugin install failed"));
			}
			return Promise.resolve({ stdout: "installed", stderr: "" });
		}

		if (sub === "update") {
			if (config.pluginUpdate === false) {
				return Promise.reject(new Error("plugin update failed"));
			}
			return Promise.resolve({ stdout: "updated", stderr: "" });
		}

		if (sub === "uninstall") {
			if (config.pluginUninstall === false) {
				return Promise.reject(new Error("uninstall failed"));
			}
			return Promise.resolve({ stdout: "uninstalled", stderr: "" });
		}

		return Promise.resolve({ stdout: "", stderr: "" });
	};
}

beforeEach(() => {
	process.env.CK_TEST_HOME = "/fake";
	useFsExtraMocks = true;
	useFsPromisesMocks = true;
});

afterEach(() => {
	useFsExtraMocks = false;
	useFsPromisesMocks = false;
	process.env.CK_TEST_HOME = originalCkTestHome;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handlePluginInstall", () => {
	beforeEach(() => {
		mockCopy.mockClear();
		mockRemove.mockClear();
		mockEnsureDir.mockClear();
		mockRename.mockClear();
		mockPathExists.mockClear();
		mockExecFileRaw.mockClear();
		mockRenameImpl = () => Promise.resolve();
		// Default: all operations succeed, plugin structure exists
		mockPathExistsImpl = () => Promise.resolve(true);
		mockExecFileImpl = buildExecMock({
			ccAvailable: true,
			marketplaceList: "",
			marketplaceAdd: true,
			pluginList: "",
			pluginInstall: true,
		});
	});

	test("returns error when Claude CLI not available", async () => {
		mockExecFileImpl = buildExecMock({ ccAvailable: false });
		const result = await handlePluginInstall("/fake/extract");
		expect(result.installed).toBe(false);
		expect(result.verified).toBe(false);
		expect(result.marketplaceRegistered).toBe(false);
		expect(result.error).toBeTruthy();
	});

	test("returns error when kit has no plugin structure", async () => {
		// pathExists returns false for both marketplace.json and plugin dir
		mockPathExistsImpl = () => Promise.resolve(false);
		mockExecFileImpl = buildExecMock({ ccAvailable: true });

		const result = await handlePluginInstall("/fake/extract");
		expect(result.installed).toBe(false);
		expect(result.error).toContain("No plugin found");
	});

	test("returns error when marketplace registration fails", async () => {
		mockExecFileImpl = buildExecMock({
			ccAvailable: true,
			marketplaceList: "",
			marketplaceAdd: false,
		});

		const result = await handlePluginInstall("/fake/extract");
		expect(result.installed).toBe(false);
		expect(result.marketplaceRegistered).toBe(false);
		expect(result.error).toContain("Marketplace registration failed");
	});

	test("returns error when plugin install fails", async () => {
		mockExecFileImpl = buildExecMock({
			ccAvailable: true,
			marketplaceList: "",
			marketplaceAdd: true,
			pluginList: "",
			pluginInstall: false,
		});

		const result = await handlePluginInstall("/fake/extract");
		expect(result.installed).toBe(false);
		expect(result.marketplaceRegistered).toBe(true);
		expect(result.error).toContain("Plugin install/update failed");
	});

	test("succeeds with fresh install pipeline", async () => {
		// Plugin list returns the installed plugin after install
		// Output format must satisfy both isInstalled ("ck@claudekit" token) and
		// verifyPluginInstalled ("ck" token AND token containing "claudekit")
		const installedLine = "ck@claudekit  ck  claudekit  1.0.0";
		let pluginListCallCount = 0;
		mockExecFileImpl = (_cmd: string, args: string[]) => {
			if (args[0] === "--version") return Promise.resolve({ stdout: "1.0.35", stderr: "" });
			if (args[0] === "plugin") {
				const sub = args[1];
				if (sub === "marketplace" && args[2] === "list")
					return Promise.resolve({ stdout: "", stderr: "" });
				if (sub === "marketplace" && args[2] === "add")
					return Promise.resolve({ stdout: "added", stderr: "" });
				if (sub === "list") {
					pluginListCallCount++;
					// First call (isInstalled check in installOrUpdatePlugin): not installed yet
					// Subsequent calls (verifyPluginInstalled): installed
					if (pluginListCallCount === 1) return Promise.resolve({ stdout: "", stderr: "" });
					return Promise.resolve({ stdout: installedLine, stderr: "" });
				}
				if (sub === "install") return Promise.resolve({ stdout: "installed", stderr: "" });
			}
			return Promise.resolve({ stdout: "", stderr: "" });
		};

		const result = await handlePluginInstall("/fake/extract");
		expect(result.installed).toBe(true);
		expect(result.marketplaceRegistered).toBe(true);
		expect(result.verified).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("succeeds with update pipeline (already installed)", async () => {
		// Plugin list always shows plugin as installed
		mockExecFileImpl = (_cmd: string, args: string[]) => {
			if (args[0] === "--version") return Promise.resolve({ stdout: "1.0.35", stderr: "" });
			if (args[0] === "plugin") {
				const sub = args[1];
				if (sub === "marketplace" && args[2] === "list")
					return Promise.resolve({ stdout: "", stderr: "" });
				if (sub === "marketplace" && args[2] === "add")
					return Promise.resolve({ stdout: "added", stderr: "" });
				if (sub === "list")
					return Promise.resolve({ stdout: "ck@claudekit  ck  claudekit  1.0.0", stderr: "" });
				if (sub === "update") return Promise.resolve({ stdout: "updated", stderr: "" });
			}
			return Promise.resolve({ stdout: "", stderr: "" });
		};

		const result = await handlePluginInstall("/fake/extract");
		expect(result.installed).toBe(true);
		expect(result.marketplaceRegistered).toBe(true);
	});

	test("handles update failure gracefully (re-verifies, still installed)", async () => {
		// Plugin is installed, update fails, but re-verify shows it's still there
		mockExecFileImpl = (_cmd: string, args: string[]) => {
			if (args[0] === "--version") return Promise.resolve({ stdout: "1.0.35", stderr: "" });
			if (args[0] === "plugin") {
				const sub = args[1];
				if (sub === "marketplace" && args[2] === "list")
					return Promise.resolve({ stdout: "", stderr: "" });
				if (sub === "marketplace" && args[2] === "add")
					return Promise.resolve({ stdout: "added", stderr: "" });
				if (sub === "list")
					return Promise.resolve({ stdout: "ck@claudekit  ck  claudekit  1.0.0", stderr: "" });
				if (sub === "update") return Promise.reject(new Error("update network error"));
			}
			return Promise.resolve({ stdout: "", stderr: "" });
		};

		const result = await handlePluginInstall("/fake/extract");
		// Update failed but plugin still listed — treated as success
		expect(result.installed).toBe(true);
		expect(result.marketplaceRegistered).toBe(true);
	});

	test("returns verified=false when post-install verification fails", async () => {
		// Fresh install succeeds but verification list shows nothing
		let pluginListCallCount = 0;
		mockExecFileImpl = (_cmd: string, args: string[]) => {
			if (args[0] === "--version") return Promise.resolve({ stdout: "1.0.35", stderr: "" });
			if (args[0] === "plugin") {
				const sub = args[1];
				if (sub === "marketplace" && args[2] === "list")
					return Promise.resolve({ stdout: "", stderr: "" });
				if (sub === "marketplace" && args[2] === "add")
					return Promise.resolve({ stdout: "added", stderr: "" });
				if (sub === "list") {
					pluginListCallCount++;
					// Always return empty — plugin never appears
					return Promise.resolve({ stdout: "", stderr: "" });
				}
				if (sub === "install") return Promise.resolve({ stdout: "installed", stderr: "" });
			}
			return Promise.resolve({ stdout: "", stderr: "" });
		};

		const result = await handlePluginInstall("/fake/extract");
		expect(result.installed).toBe(true);
		expect(result.verified).toBe(false);
		expect(result.error).toBeTruthy();
	});
});

describe("handlePluginUninstall", () => {
	beforeEach(() => {
		mockCopy.mockClear();
		mockRemove.mockClear();
		mockEnsureDir.mockClear();
		mockRename.mockClear();
		mockPathExists.mockClear();
		mockExecFileRaw.mockClear();
		mockRenameImpl = () => Promise.resolve();
		mockPathExistsImpl = () => Promise.resolve(true);
		mockExecFileImpl = buildExecMock({
			ccAvailable: true,
			pluginList: "",
		});
	});

	test("skips cleanup when Claude CLI not available", async () => {
		mockExecFileImpl = buildExecMock({ ccAvailable: false });
		// Should resolve without throwing
		await expect(handlePluginUninstall()).resolves.toBeUndefined();
	});

	test("uninstalls plugin and removes marketplace", async () => {
		// Plugin is installed
		mockExecFileImpl = (_cmd: string, args: string[]) => {
			if (args[0] === "--version") return Promise.resolve({ stdout: "1.0.35", stderr: "" });
			if (args[0] === "plugin") {
				const sub = args[1];
				if (sub === "list")
					return Promise.resolve({ stdout: "ck@claudekit  ck  claudekit  1.0.0", stderr: "" });
				if (sub === "uninstall") return Promise.resolve({ stdout: "uninstalled", stderr: "" });
				if (sub === "marketplace" && args[2] === "remove")
					return Promise.resolve({ stdout: "removed", stderr: "" });
			}
			return Promise.resolve({ stdout: "", stderr: "" });
		};

		await expect(handlePluginUninstall()).resolves.toBeUndefined();
		// Marketplace directory should be cleaned up (pathExists returns true → remove called)
		expect(mockRemove).toHaveBeenCalledTimes(1);
	});

	test("handles already-uninstalled plugin idempotently", async () => {
		// Plugin not installed, marketplace not registered
		mockExecFileImpl = (_cmd: string, args: string[]) => {
			if (args[0] === "--version") return Promise.resolve({ stdout: "1.0.35", stderr: "" });
			if (args[0] === "plugin") {
				const sub = args[1];
				if (sub === "list") return Promise.resolve({ stdout: "", stderr: "" });
				// marketplace remove still runs (idempotent)
				if (sub === "marketplace" && args[2] === "remove")
					return Promise.resolve({ stdout: "", stderr: "" });
			}
			return Promise.resolve({ stdout: "", stderr: "" });
		};

		// Should complete without errors
		await expect(handlePluginUninstall()).resolves.toBeUndefined();
	});
});
