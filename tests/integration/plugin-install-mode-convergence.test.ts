import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PromptKitUpdateDeps } from "@/commands/update-cli.js";
import { promptKitUpdate } from "@/commands/update-cli.js";
import type { InstallModeReport } from "@/domains/installation/plugin/install-mode-detector.js";

interface TestEnv {
	root: string;
	home: string;
	globalClaudeDir: string;
	codexHome: string;
	binDir: string;
	codexLog: string;
}

const ENV_KEYS = [
	"PATH",
	"HOME",
	"USERPROFILE",
	"APPDATA",
	"LOCALAPPDATA",
	"CODEX_HOME",
	"CK_TEST_HOME",
	"FAKE_CODEX_LOG",
	"FAKE_CODEX_LIST_JSON",
] as const;

let previousEnv: Partial<Record<(typeof ENV_KEYS)[number], string>>;
let testEnv: TestEnv;

describe("plugin install-mode convergence integration", () => {
	beforeEach(async () => {
		previousEnv = {};
		for (const key of ENV_KEYS) previousEnv[key] = process.env[key];

		const root = await mkdtemp(join(tmpdir(), "ck-install-mode-convergence-"));
		testEnv = {
			root,
			home: join(root, "home"),
			globalClaudeDir: join(root, "home", ".claude"),
			codexHome: join(root, "codex-home"),
			binDir: join(root, "bin"),
			codexLog: join(root, "codex.log"),
		};

		await mkdir(testEnv.globalClaudeDir, { recursive: true });
		await mkdir(testEnv.codexHome, { recursive: true });
		await writeFakeCodex(testEnv.binDir);

		process.env.PATH = `${testEnv.binDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`;
		process.env.HOME = testEnv.home;
		process.env.USERPROFILE = testEnv.home;
		process.env.APPDATA = join(testEnv.home, "AppData", "Roaming");
		process.env.LOCALAPPDATA = join(testEnv.home, "AppData", "Local");
		process.env.CODEX_HOME = testEnv.codexHome;
		process.env.CK_TEST_HOME = testEnv.home;
		process.env.FAKE_CODEX_LOG = testEnv.codexLog;
	});

	afterEach(async () => {
		for (const key of ENV_KEYS) {
			const value = previousEnv[key];
			if (value === undefined) {
				Reflect.deleteProperty(process.env, key);
			} else {
				process.env[key] = value;
			}
		}
		await rm(testEnv.root, { recursive: true, force: true });
	});

	test("refreshes stale Codex plugin state for default auto preference", async () => {
		process.env.FAKE_CODEX_LIST_JSON = JSON.stringify({
			installed: [
				{
					pluginId: "ck@claudekit",
					installed: true,
					enabled: true,
					version: "v0.9.0",
					marketplace: "claudekit",
				},
			],
		});
		await writeMetadata(testEnv.globalClaudeDir, "1.0.0");

		const capture = createUpdateCapture({
			detectInstallMode: () => makeInstallModeReport(testEnv.globalClaudeDir, "plugin"),
			latestVersion: "v1.0.0",
		});

		await promptKitUpdate(false, true, capture.deps);

		expect(capture.execCommands).toEqual([
			"ck init -g --kit engineer --yes --restore-ck-hooks --install-mode auto --install-skills",
		]);
		const codexCalls = await readCodexCalls(testEnv.codexLog);
		expect(codexCalls.map((call) => call.args.join(" "))).toEqual([
			"--version",
			"plugin --help",
			"plugin list --json",
		]);
		expect(codexCalls.every((call) => call.codexHome === testEnv.codexHome)).toBe(true);
	});

	test("preserves explicit legacy preference and does not probe Codex during update", async () => {
		process.env.FAKE_CODEX_LIST_JSON = JSON.stringify({
			installed: [
				{
					pluginId: "ck@claudekit",
					installed: true,
					enabled: true,
					version: "v0.9.0",
					marketplace: "claudekit",
				},
			],
		});
		await writeMetadata(testEnv.globalClaudeDir, "1.0.0", "legacy");

		const capture = createUpdateCapture({
			detectInstallMode: () => makeInstallModeReport(testEnv.globalClaudeDir, "legacy"),
			latestVersion: "v2.0.0",
		});

		await promptKitUpdate(false, true, capture.deps);

		expect(capture.execCommands).toEqual([
			"ck init -g --kit engineer --yes --install-mode legacy --install-skills",
		]);
		await expect(readCodexCalls(testEnv.codexLog)).resolves.toEqual([]);
	});
});

function createUpdateCapture(options: {
	detectInstallMode: () => InstallModeReport;
	latestVersion: string;
}): { deps: PromptKitUpdateDeps; execCommands: string[] } {
	const execCommands: string[] = [];
	const deps: PromptKitUpdateDeps = {
		execAsyncFn: async (cmd: string) => {
			execCommands.push(cmd);
			return { stdout: "", stderr: "" };
		},
		getSetupFn: async () => ({
			global: {
				path: testEnv.globalClaudeDir,
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
		getLatestReleaseTagFn: async () => options.latestVersion,
		loadFullConfigFn: async () => ({ config: { updatePipeline: undefined } }),
		confirmFn: async () => true,
		isCancelFn: (value: unknown) => value === "cancelled",
		findMissingHookDependenciesFn: async () => [],
		countMissingHookFileReferencesFn: async () => 0,
		detectInstallModeFn: options.detectInstallMode,
		hasTrackedPluginSuppliedLegacyFilesFn: () => false,
	};
	return { deps, execCommands };
}

async function writeMetadata(
	dir: string,
	version: string,
	installModePreference?: "auto" | "plugin" | "legacy",
): Promise<void> {
	await writeFile(
		join(dir, "metadata.json"),
		JSON.stringify(
			{
				version: "1.0.0",
				kits: {
					engineer: {
						version,
						installedAt: "2026-07-02T00:00:00.000Z",
						...(installModePreference ? { installModePreference } : {}),
					},
				},
			},
			null,
			2,
		),
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

async function writeFakeCodex(binDir: string): Promise<void> {
	await mkdir(binDir, { recursive: true });
	const scriptPath = join(binDir, "fake-codex.cjs");
	await writeFile(
		scriptPath,
		`const fs = require("node:fs");
const args = process.argv.slice(2);
if (process.env.FAKE_CODEX_LOG) {
  fs.appendFileSync(
    process.env.FAKE_CODEX_LOG,
    JSON.stringify({ args, codexHome: process.env.CODEX_HOME || null }) + "\\n",
  );
}
if (args[0] === "--version") {
  console.log("codex 0.0.0-test");
  process.exit(0);
}
if (args[0] === "plugin" && args[1] === "--help") {
  console.log("Usage: codex plugin marketplace add");
  process.exit(0);
}
if (args[0] === "plugin" && args[1] === "list" && args[2] === "--json") {
  console.log(process.env.FAKE_CODEX_LIST_JSON || '{"installed":[]}');
  process.exit(0);
}
if (args[0] === "plugin" && args[1] === "list") {
  console.log("ck@claudekit installed enabled v0.0.0");
  process.exit(0);
}
if (args[0] === "plugin" && ["add", "remove"].includes(args[1])) {
  console.log("ok");
  process.exit(0);
}
if (args[0] === "plugin" && args[1] === "marketplace" && ["add", "remove"].includes(args[2])) {
  console.log("ok");
  process.exit(0);
}
console.error("unexpected fake codex args: " + args.join(" "));
process.exit(2);
`,
	);

	const posixShim = join(binDir, "codex");
	await writeFile(posixShim, "#!/usr/bin/env node\nrequire('./fake-codex.cjs');\n");
	await chmod(posixShim, 0o755);

	await writeFile(join(binDir, "codex.cmd"), '@echo off\r\nnode "%~dp0\\fake-codex.cjs" %*\r\n');
}

async function readCodexCalls(
	logPath: string,
): Promise<Array<{ args: string[]; codexHome: string }>> {
	try {
		const content = await readFile(logPath, "utf-8");
		return content
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as { args: string[]; codexHome: string });
	} catch {
		return [];
	}
}
