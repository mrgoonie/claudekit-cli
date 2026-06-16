import { describe, expect, test } from "bun:test";
import {
	type ClaudeRunResult,
	type ClaudeRunner,
	PluginInstaller,
} from "@/domains/installation/plugin/plugin-installer.js";

/** Records every argv the installer sends and returns scripted results. */
function fakeRunner(
	results: ClaudeRunResult | ClaudeRunResult[] = { ok: true, stdout: "", stderr: "", code: 0 },
): { runner: ClaudeRunner; calls: string[][]; configDirs: (string | undefined)[] } {
	const calls: string[][] = [];
	const configDirs: (string | undefined)[] = [];
	const queue = Array.isArray(results) ? [...results] : null;
	const runner: ClaudeRunner = async (args, opts) => {
		calls.push(args);
		configDirs.push(opts?.configDir);
		if (queue) return queue.shift() ?? { ok: true, stdout: "", stderr: "", code: 0 };
		return results as ClaudeRunResult;
	};
	return { runner, calls, configDirs };
}

describe("PluginInstaller command construction", () => {
	test("install targets ck@claudekit at the requested scope", async () => {
		const { runner, calls } = fakeRunner();
		await new PluginInstaller(runner).install("user");
		expect(calls[0]).toEqual(["plugin", "install", "ck@claudekit", "--scope", "user"]);
	});

	test("marketplaceAdd forwards the source", async () => {
		const { runner, calls } = fakeRunner();
		await new PluginInstaller(runner).marketplaceAdd("/tmp/kit");
		expect(calls[0]).toEqual(["plugin", "marketplace", "add", "/tmp/kit"]);
	});

	test("uninstall / update / enable target the ck plugin", async () => {
		const { runner, calls } = fakeRunner();
		const inst = new PluginInstaller(runner);
		await inst.uninstall();
		await inst.update();
		await inst.enable();
		expect(calls).toEqual([
			["plugin", "uninstall", "ck"],
			["plugin", "update", "ck"],
			["plugin", "enable", "ck"],
		]);
	});

	test("configDir is threaded into every spawned command", async () => {
		const { runner, configDirs } = fakeRunner();
		await new PluginInstaller(runner, "/tmp/cfg").install();
		expect(configDirs[0]).toBe("/tmp/cfg");
	});
});

describe("PluginInstaller result handling", () => {
	test("isPluginSupported true only when help mentions marketplace", async () => {
		const yes = fakeRunner({
			ok: true,
			stdout: "Manage Claude Code marketplaces",
			stderr: "",
			code: 0,
		});
		const no = fakeRunner({ ok: true, stdout: "no such subcommand", stderr: "", code: 0 });
		expect(await new PluginInstaller(yes.runner).isPluginSupported()).toBe(true);
		expect(await new PluginInstaller(no.runner).isPluginSupported()).toBe(false);
	});

	test("isClaudeAvailable reflects runner ok flag", async () => {
		const ok = fakeRunner({ ok: true, stdout: "2.1.178", stderr: "", code: 0 });
		const fail = fakeRunner({ ok: false, stdout: "", stderr: "not found", code: 127 });
		expect(await new PluginInstaller(ok.runner).isClaudeAvailable()).toBe(true);
		expect(await new PluginInstaller(fail.runner).isClaudeAvailable()).toBe(false);
	});

	test("verifyInstalled requires the plugin present AND enabled in list output", async () => {
		const enabled = fakeRunner({
			ok: true,
			stdout: "  ck@claudekit\n  Status: enabled",
			stderr: "",
			code: 0,
		});
		const disabled = fakeRunner({
			ok: true,
			stdout: "  ck@claudekit\n  Status: disabled",
			stderr: "",
			code: 0,
		});
		const absent = fakeRunner({ ok: true, stdout: "No plugins installed.", stderr: "", code: 0 });
		expect(await new PluginInstaller(enabled.runner).verifyInstalled()).toBe(true);
		expect(await new PluginInstaller(disabled.runner).verifyInstalled()).toBe(false);
		expect(await new PluginInstaller(absent.runner).verifyInstalled()).toBe(false);
	});

	test("verifyInstalled false when list command fails", async () => {
		const broken = fakeRunner({ ok: false, stdout: "", stderr: "boom", code: 1 });
		expect(await new PluginInstaller(broken.runner).verifyInstalled()).toBe(false);
	});

	test("verifyInstalled false when ck is disabled even if ANOTHER plugin is enabled", async () => {
		// status must come from ck's own block, not a different plugin's enabled line
		const multi = fakeRunner({
			ok: true,
			stdout: "  ck@claudekit\n    Status: disabled\n  foo@bar\n    Status: enabled",
			stderr: "",
			code: 0,
		});
		expect(await new PluginInstaller(multi.runner).verifyInstalled()).toBe(false);
	});

	test("verifyInstalled true when ck enabled and a later plugin is disabled", async () => {
		const multi = fakeRunner({
			ok: true,
			stdout: "  ck@claudekit\n    Status: enabled\n  foo@bar\n    Status: disabled",
			stderr: "",
			code: 0,
		});
		expect(await new PluginInstaller(multi.runner).verifyInstalled()).toBe(true);
	});

	test("verifyInstalled does not match a different plugin named my-ck@", async () => {
		const lookalike = fakeRunner({
			ok: true,
			stdout: "  my-ck@somewhere\n    Status: enabled",
			stderr: "",
			code: 0,
		});
		expect(await new PluginInstaller(lookalike.runner).verifyInstalled()).toBe(false);
	});
});
