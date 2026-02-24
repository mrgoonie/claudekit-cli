import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { handlePluginInstall, handlePluginUninstall } from "@/services/plugin-installer.js";

interface TestContext {
	testHome: string;
	extractDir: string;
	stateDir: string;
}

const tempDirs: string[] = [];
const originalEnv = {
	CK_TEST_HOME: process.env.CK_TEST_HOME,
	PATH: process.env.PATH,
	Path: process.env.Path,
};

const FAKE_ENV_KEYS = [
	"FAKE_CLAUDE_AVAILABLE",
	"FAKE_CLAUDE_VERSION",
	"FAKE_FAIL_MARKETPLACE_ADD",
	"FAKE_FAIL_MARKETPLACE_REMOVE",
	"FAKE_FAIL_PLUGIN_INSTALL",
	"FAKE_FAIL_PLUGIN_UPDATE",
	"FAKE_FAIL_PLUGIN_UNINSTALL",
	"FAKE_FORCE_PLUGIN_LIST_EMPTY",
	"FAKE_SKIP_INSTALL_STATE",
];

function randomId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function writeFakeClaudeBinary(binDir: string): Promise<void> {
	await mkdir(binDir, { recursive: true });

	const scriptPath = join(binDir, "claude");
	const script = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const testHome = process.env.CK_TEST_HOME || process.cwd();
const stateDir = path.join(testHome, ".claudekit", "fake-claude-state");
const marketplaceFlag = path.join(stateDir, "marketplace-registered");
const pluginFlag = path.join(stateDir, "plugin-installed");
fs.mkdirSync(stateDir, { recursive: true });

function fail(message) {
  if (message) process.stderr.write(String(message));
  process.exit(1);
}

function ok(output) {
  if (output) process.stdout.write(String(output));
  process.exit(0);
}

const args = process.argv.slice(2);

if (args[0] === "--version") {
  if (process.env.FAKE_CLAUDE_AVAILABLE === "0") {
    fail("command not found: claude");
  }
  ok(process.env.FAKE_CLAUDE_VERSION || "1.0.35");
}

if (args[0] !== "plugin") {
  fail("unsupported command");
}

const command = args[1];
const action = args[2];

if (command === "marketplace") {
  if (action === "list") {
    ok(fs.existsSync(marketplaceFlag) ? "claudekit /tmp/marketplace" : "");
  }
  if (action === "add") {
    if (process.env.FAKE_FAIL_MARKETPLACE_ADD === "1") {
      fail("marketplace add failed");
    }
    fs.writeFileSync(marketplaceFlag, "1");
    ok("added");
  }
  if (action === "remove") {
    if (process.env.FAKE_FAIL_MARKETPLACE_REMOVE === "1") {
      fail("marketplace remove failed");
    }
    fs.rmSync(marketplaceFlag, { force: true });
    ok("removed");
  }
  fail("unsupported marketplace command");
}

if (command === "list") {
  if (process.env.FAKE_FORCE_PLUGIN_LIST_EMPTY === "1") {
    ok("");
  }
  ok(fs.existsSync(pluginFlag) ? "ck@claudekit  ck  claudekit  1.0.0" : "");
}

if (command === "install") {
  if (process.env.FAKE_FAIL_PLUGIN_INSTALL === "1") {
    fail("plugin install failed");
  }
  if (process.env.FAKE_SKIP_INSTALL_STATE !== "1") {
    fs.writeFileSync(pluginFlag, "1");
  }
  ok("installed");
}

if (command === "update") {
  if (process.env.FAKE_FAIL_PLUGIN_UPDATE === "1") {
    fail("plugin update failed");
  }
  fs.writeFileSync(pluginFlag, "1");
  ok("updated");
}

if (command === "uninstall") {
  if (process.env.FAKE_FAIL_PLUGIN_UNINSTALL === "1") {
    fail("plugin uninstall failed");
  }
  fs.rmSync(pluginFlag, { force: true });
  ok("uninstalled");
}

fail("unsupported plugin command");
`;
	await writeFile(scriptPath, script, "utf-8");
	await chmod(scriptPath, 0o755);

	// Windows lookup support when shell:true uses PATHEXT.
	const cmdWrapperPath = join(binDir, "claude.cmd");
	await writeFile(cmdWrapperPath, '@echo off\r\nnode "%~dp0\\claude" %*\r\n', "utf-8");
}

async function createExtractDir(testHome: string, withPluginStructure: boolean): Promise<string> {
	const extractDir = join(testHome, `extract-${randomId()}`);
	await mkdir(extractDir, { recursive: true });

	if (withPluginStructure) {
		await mkdir(join(extractDir, ".claude-plugin"), { recursive: true });
		await writeFile(
			join(extractDir, ".claude-plugin", "marketplace.json"),
			JSON.stringify({ name: "claudekit" }),
			"utf-8",
		);

		await mkdir(join(extractDir, "plugins", "ck", ".claude-plugin"), { recursive: true });
		await writeFile(
			join(extractDir, "plugins", "ck", ".claude-plugin", "plugin.json"),
			JSON.stringify({ name: "ck" }),
			"utf-8",
		);
	}

	return extractDir;
}

async function seedFakeState(stateDir: string, opts: { plugin?: boolean; marketplace?: boolean }) {
	await mkdir(stateDir, { recursive: true });
	if (opts.plugin) {
		await writeFile(join(stateDir, "plugin-installed"), "1", "utf-8");
	}
	if (opts.marketplace) {
		await writeFile(join(stateDir, "marketplace-registered"), "1", "utf-8");
	}
}

async function setupTestContext(withPluginStructure = true): Promise<TestContext> {
	const testHome = await mkdtemp(join(tmpdir(), "ck-plugin-installer-"));
	tempDirs.push(testHome);

	process.env.CK_TEST_HOME = testHome;

	const binDir = join(testHome, "bin");
	await writeFakeClaudeBinary(binDir);
	const basePath = originalEnv.PATH ?? originalEnv.Path ?? "";
	const testPath = basePath ? `${binDir}${delimiter}${basePath}` : binDir;
	process.env.PATH = testPath;
	process.env.Path = testPath;

	const extractDir = await createExtractDir(testHome, withPluginStructure);
	const stateDir = join(testHome, ".claudekit", "fake-claude-state");
	await mkdir(stateDir, { recursive: true });

	return { testHome, extractDir, stateDir };
}

function restoreEnvVar(key: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[key];
		return;
	}
	process.env[key] = value;
}

beforeEach(() => {
	for (const key of FAKE_ENV_KEYS) {
		delete process.env[key];
	}
});

afterEach(async () => {
	for (const key of FAKE_ENV_KEYS) {
		delete process.env[key];
	}

	restoreEnvVar("CK_TEST_HOME", originalEnv.CK_TEST_HOME);
	restoreEnvVar("PATH", originalEnv.PATH);
	restoreEnvVar("Path", originalEnv.Path);

	for (const dir of tempDirs.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

describe("handlePluginInstall", () => {
	test("returns error when Claude CLI not available", async () => {
		const ctx = await setupTestContext(true);
		process.env.FAKE_CLAUDE_AVAILABLE = "0";

		const result = await handlePluginInstall(ctx.extractDir);
		expect(result.installed).toBe(false);
		expect(result.verified).toBe(false);
		expect(result.marketplaceRegistered).toBe(false);
		expect(result.error).toContain("Claude Code CLI not found");
	});

	test("returns error when kit has no plugin structure", async () => {
		const ctx = await setupTestContext(false);

		const result = await handlePluginInstall(ctx.extractDir);
		expect(result.installed).toBe(false);
		expect(result.verified).toBe(false);
		expect(result.error).toContain("No plugin found");
	});

	test("returns error when marketplace registration fails", async () => {
		const ctx = await setupTestContext(true);
		process.env.FAKE_FAIL_MARKETPLACE_ADD = "1";

		const result = await handlePluginInstall(ctx.extractDir);
		expect(result.installed).toBe(false);
		expect(result.marketplaceRegistered).toBe(false);
		expect(result.error).toContain("Marketplace registration failed");
	});

	test("returns error when plugin install fails", async () => {
		const ctx = await setupTestContext(true);
		process.env.FAKE_FAIL_PLUGIN_INSTALL = "1";

		const result = await handlePluginInstall(ctx.extractDir);
		expect(result.installed).toBe(false);
		expect(result.marketplaceRegistered).toBe(true);
		expect(result.verified).toBe(false);
		expect(result.error).toContain("Plugin install/update failed");
	});

	test("succeeds with fresh install pipeline", async () => {
		const ctx = await setupTestContext(true);
		const result = await handlePluginInstall(ctx.extractDir);

		expect(result.installed).toBe(true);
		expect(result.marketplaceRegistered).toBe(true);
		expect(result.verified).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("succeeds with update pipeline when plugin already installed", async () => {
		const ctx = await setupTestContext(true);
		await seedFakeState(ctx.stateDir, { plugin: true });

		const result = await handlePluginInstall(ctx.extractDir);
		expect(result.installed).toBe(true);
		expect(result.marketplaceRegistered).toBe(true);
		expect(result.verified).toBe(true);
	});

	test("handles update failure gracefully when plugin is still installed", async () => {
		const ctx = await setupTestContext(true);
		await seedFakeState(ctx.stateDir, { plugin: true });
		process.env.FAKE_FAIL_PLUGIN_UPDATE = "1";

		const result = await handlePluginInstall(ctx.extractDir);
		expect(result.installed).toBe(true);
		expect(result.marketplaceRegistered).toBe(true);
		expect(result.verified).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("returns verified=false when post-install verification fails", async () => {
		const ctx = await setupTestContext(true);
		process.env.FAKE_SKIP_INSTALL_STATE = "1";

		const result = await handlePluginInstall(ctx.extractDir);
		expect(result.installed).toBe(true);
		expect(result.marketplaceRegistered).toBe(true);
		expect(result.verified).toBe(false);
		expect(result.error).toContain("Post-install verification failed");
	});
});

describe("handlePluginUninstall", () => {
	test("skips cleanup when Claude CLI not available", async () => {
		const ctx = await setupTestContext(true);
		const marketplacePath = join(ctx.testHome, ".claudekit", "marketplace");
		await mkdir(marketplacePath, { recursive: true });
		process.env.FAKE_CLAUDE_AVAILABLE = "0";

		await expect(handlePluginUninstall()).resolves.toBeUndefined();
		expect(existsSync(marketplacePath)).toBe(true);
	});

	test("uninstalls plugin and removes marketplace directory", async () => {
		const ctx = await setupTestContext(true);
		await seedFakeState(ctx.stateDir, { plugin: true, marketplace: true });

		const marketplacePath = join(ctx.testHome, ".claudekit", "marketplace");
		await mkdir(join(marketplacePath, "plugins", "ck"), { recursive: true });
		await mkdir(join(marketplacePath, ".claude-plugin"), { recursive: true });
		await writeFile(join(marketplacePath, ".claude-plugin", "marketplace.json"), "{}", "utf-8");

		await expect(handlePluginUninstall()).resolves.toBeUndefined();
		expect(existsSync(marketplacePath)).toBe(false);
	});

	test("handles already-uninstalled plugin idempotently", async () => {
		await setupTestContext(true);
		await expect(handlePluginUninstall()).resolves.toBeUndefined();
	});
});
