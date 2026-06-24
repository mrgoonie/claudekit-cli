import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginInstallModeChecker } from "@/domains/health-checks/plugin-install-mode-checker.js";

describe("PluginInstallModeChecker", () => {
	let claudeDir: string;

	beforeEach(async () => {
		claudeDir = join(tmpdir(), `ck-doctor-${Date.now()}-${Math.round(performance.now())}`);
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(claudeDir, { recursive: true, force: true });
	});

	const writeSettings = (enabledPlugins: Record<string, boolean>) =>
		writeFile(join(claudeDir, "settings.json"), JSON.stringify({ enabledPlugins }), "utf-8");
	const writeMetadata = (obj: unknown) =>
		writeFile(join(claudeDir, "metadata.json"), JSON.stringify(obj), "utf-8");

	async function single() {
		const results = await new PluginInstallModeChecker(claudeDir).run();
		expect(results).toHaveLength(1);
		return results[0];
	}

	test("fresh -> info", async () => {
		const r = await single();
		expect(r.status).toBe("info");
		expect(r.message).toContain("fresh");
		expect(r.group).toBe("claudekit");
		expect(r.autoFixable).toBe(false);
	});

	test("legacy -> pass with version", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x" } } });
		const r = await single();
		expect(r.status).toBe("pass");
		expect(r.message).toContain("legacy");
		expect(r.message).toContain("2.19.0");
	});

	test("plugin enabled -> pass", async () => {
		await writeSettings({ "ck@claudekit": true });
		const r = await single();
		expect(r.status).toBe("pass");
		expect(r.message.toLowerCase()).toContain("plugin");
		expect(r.message).toContain("enabled");
	});

	test("plugin installed but disabled -> warn with enable hint", async () => {
		await writeSettings({ "ck@claudekit": false });
		const r = await single();
		expect(r.status).toBe("warn");
		expect(r.message).toContain("claude plugin enable ck");
	});

	test("mixed -> warn with migrate hint", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x" } } });
		await writeSettings({ "ck@claudekit": true });
		const r = await single();
		expect(r.status).toBe("warn");
		expect(r.message).toContain("mixed");
		expect(r.message).toContain("ck update");
	});
});
