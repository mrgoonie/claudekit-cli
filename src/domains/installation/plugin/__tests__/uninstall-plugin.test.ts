import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type ClaudeRunResult,
	type ClaudeRunner,
	PluginInstaller,
} from "@/domains/installation/plugin/plugin-installer.js";
import { uninstallEnginePlugin } from "@/domains/installation/plugin/uninstall-plugin.js";

function recordingInstaller(onCall?: (args: string[]) => Promise<void> | void) {
	const calls: string[][] = [];
	const runner: ClaudeRunner = async (args): Promise<ClaudeRunResult> => {
		calls.push(args);
		await onCall?.(args);
		return { ok: true, stdout: "", stderr: "", code: 0 };
	};
	return { installer: new PluginInstaller(runner), calls };
}

describe("uninstallEnginePlugin", () => {
	let claudeDir: string;
	beforeEach(async () => {
		claudeDir = join(tmpdir(), `ck-unp-${Date.now()}-${Math.round(performance.now())}`);
		await mkdir(claudeDir, { recursive: true });
	});
	afterEach(async () => {
		await rm(claudeDir, { recursive: true, force: true });
	});

	const cacheDir = () => join(claudeDir, "plugins", "cache", "claudekit", "ck");

	test("registered plugin: uninstalls, removes marketplace, purges cache", async () => {
		await writeFile(
			join(claudeDir, "settings.json"),
			JSON.stringify({ enabledPlugins: { "ck@claudekit": true } }),
			"utf-8",
		);
		await mkdir(join(cacheDir(), "v1"), { recursive: true });
		const { installer, calls } = recordingInstaller(async (args) => {
			if (args.join(" ") === "plugin uninstall ck") {
				await writeFile(join(claudeDir, "settings.json"), JSON.stringify({ enabledPlugins: {} }));
			}
		});

		const r = await uninstallEnginePlugin({ claudeDir, installer });

		expect(r.uninstalled).toBe(true);
		expect(r.staleCacheRemoved).toBe(true);
		expect(r.pluginStillInstalled).toBe(false);
		expect(r.error).toBeUndefined();
		expect(calls).toContainEqual(["plugin", "uninstall", "ck"]);
		expect(calls).toContainEqual(["plugin", "marketplace", "remove", "claudekit"]);
		expect(existsSync(cacheDir())).toBe(false);
	});

	test("nothing installed: no-op, no claude calls", async () => {
		const { installer, calls } = recordingInstaller();
		const r = await uninstallEnginePlugin({ claudeDir, installer });
		expect(r).toEqual({
			uninstalled: false,
			staleCacheRemoved: false,
			pluginStillInstalled: false,
			error: undefined,
		});
		expect(calls).toHaveLength(0);
	});

	test("orphaned stale cache only: purges cache, does NOT call uninstall", async () => {
		await mkdir(join(cacheDir(), "v1"), { recursive: true });
		const { installer, calls } = recordingInstaller();
		const r = await uninstallEnginePlugin({ claudeDir, installer });
		expect(r.uninstalled).toBe(false);
		expect(r.staleCacheRemoved).toBe(true);
		expect(r.pluginStillInstalled).toBe(false);
		expect(calls).toHaveLength(0); // not registered -> no uninstall command
		expect(existsSync(cacheDir())).toBe(false);
	});

	test("reports when the plugin remains registered after cleanup commands", async () => {
		await writeFile(
			join(claudeDir, "settings.json"),
			JSON.stringify({ enabledPlugins: { "ck@claudekit": true } }),
			"utf-8",
		);
		const { installer } = recordingInstaller();

		const r = await uninstallEnginePlugin({ claudeDir, installer });

		expect(r.uninstalled).toBe(true);
		expect(r.pluginStillInstalled).toBe(true);
		expect(r.error).toContain("plugin remains registered");
	});
});
