import { describe, expect, test } from "bun:test";
import {
	CodexPluginInstaller,
	type CodexRunResult,
	installCodexPlugin,
	removeCodexPlugin,
	resolveCodexExecutable,
	shouldRefreshCodexPlugin,
	shouldRunCodexInShell,
} from "@/domains/installation/plugin/codex-plugin-installer.js";

function ok(stdout = "", stderr = ""): CodexRunResult {
	return { ok: true, stdout, stderr, code: 0 };
}

function fail(stderr = "failed"): CodexRunResult {
	return { ok: false, stdout: "", stderr, code: 1 };
}

describe("CodexPluginInstaller", () => {
	test("uses the Windows command shim through a shell", () => {
		expect(resolveCodexExecutable("win32")).toBe("codex.cmd");
		expect(shouldRunCodexInShell("win32")).toBe(true);
		expect(resolveCodexExecutable("linux")).toBe("codex");
		expect(shouldRunCodexInShell("linux")).toBe(false);
	});

	test("installs ck@claudekit through a local marketplace", async () => {
		const calls: string[][] = [];
		const installer = new CodexPluginInstaller(async (args) => {
			calls.push(args);
			if (args.join(" ") === "--version") return ok("codex-cli 0.143.0-alpha.14");
			if (args.join(" ") === "plugin --help") return ok("plugin marketplace add");
			if (args.join(" ") === "plugin marketplace add /tmp/plugin-source") return ok();
			if (args.join(" ") === "plugin add ck@claudekit") return ok();
			if (args.join(" ") === "plugin list --json") {
				return ok(
					JSON.stringify({
						installed: [
							{
								pluginId: "ck@claudekit",
								installed: true,
								enabled: true,
							},
						],
					}),
				);
			}
			return fail(`unexpected command: ${args.join(" ")}`);
		});

		const result = await installCodexPlugin({
			pluginSourceDir: "/tmp/plugin-source",
			installer,
		});

		expect(result).toEqual({ action: "installed", pluginVerified: true });
		expect(calls).toEqual([
			["--version"],
			["plugin", "--help"],
			["plugin", "marketplace", "add", "/tmp/plugin-source"],
			["plugin", "add", "ck@claudekit"],
			["plugin", "list", "--json"],
		]);
	});

	test("skips when Codex lacks plugin support", async () => {
		const installer = new CodexPluginInstaller(async (args) => {
			if (args.join(" ") === "--version") return ok("codex-cli 0.142.0");
			if (args.join(" ") === "plugin --help") return fail("unknown command");
			return fail("should not install");
		});

		await expect(
			installCodexPlugin({ pluginSourceDir: "/tmp/source", installer }),
		).resolves.toEqual({
			action: "skipped-codex-unsupported",
			pluginVerified: false,
		});
	});

	test("reports marketplace add failures", async () => {
		const installer = new CodexPluginInstaller(async (args) => {
			if (args.join(" ") === "--version") return ok("codex-cli 0.143.0-alpha.14");
			if (args.join(" ") === "plugin --help") return ok("plugin marketplace add");
			if (args.join(" ") === "plugin marketplace add /tmp/source") return fail("bad marketplace");
			return fail("should not install");
		});

		const result = await installCodexPlugin({ pluginSourceDir: "/tmp/source", installer });

		expect(result.action).toBe("install-failed");
		expect(result.pluginVerified).toBe(false);
		expect(result.error).toContain("bad marketplace");
	});

	test("asks update self-heal to refresh only when supported Codex is missing ck", async () => {
		const installed = new CodexPluginInstaller(async (args) => {
			if (args.join(" ") === "--version") return ok("codex-cli 0.143.0-alpha.14");
			if (args.join(" ") === "plugin --help") return ok("plugin marketplace add");
			if (args.join(" ") === "plugin list --json") {
				return ok(
					JSON.stringify({
						installed: [{ pluginId: "ck@claudekit", installed: true, enabled: true }],
					}),
				);
			}
			return fail("unexpected");
		});
		await expect(shouldRefreshCodexPlugin(installed)).resolves.toBe(false);

		const missing = new CodexPluginInstaller(async (args) => {
			if (args.join(" ") === "--version") return ok("codex-cli 0.143.0-alpha.14");
			if (args.join(" ") === "plugin --help") return ok("plugin marketplace add");
			if (args.join(" ") === "plugin list --json") return ok(JSON.stringify({ installed: [] }));
			return fail("unexpected");
		});
		await expect(shouldRefreshCodexPlugin(missing)).resolves.toBe(true);
	});

	test("removes ck@claudekit and the marketplace when Codex plugins are supported", async () => {
		const calls: string[][] = [];
		const installer = new CodexPluginInstaller(async (args) => {
			calls.push(args);
			if (args.join(" ") === "--version") return ok("codex-cli 0.143.0-alpha.14");
			if (args.join(" ") === "plugin --help") return ok("plugin marketplace add");
			if (args.join(" ") === "plugin remove ck@claudekit") return ok();
			if (args.join(" ") === "plugin marketplace remove claudekit") return ok();
			return fail(`unexpected command: ${args.join(" ")}`);
		});

		await expect(removeCodexPlugin({ installer })).resolves.toEqual({
			removed: true,
			marketplaceRemoved: true,
		});
		expect(calls).toEqual([
			["--version"],
			["plugin", "--help"],
			["plugin", "remove", "ck@claudekit"],
			["plugin", "marketplace", "remove", "claudekit"],
		]);
	});

	test("skips Codex plugin removal when Codex has no plugin support", async () => {
		const calls: string[][] = [];
		const installer = new CodexPluginInstaller(async (args) => {
			calls.push(args);
			if (args.join(" ") === "--version") return ok("codex-cli 0.142.0");
			if (args.join(" ") === "plugin --help") return fail("unknown command");
			return fail("should not remove");
		});

		await expect(removeCodexPlugin({ installer })).resolves.toEqual({
			removed: false,
			marketplaceRemoved: false,
		});
		expect(calls).toEqual([["--version"], ["plugin", "--help"]]);
	});
});
