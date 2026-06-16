import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	classifyInstallMode,
	detectInstallMode,
	detectLegacyState,
	detectPluginState,
} from "@/domains/installation/plugin/install-mode-detector.js";

describe("install-mode-detector", () => {
	let claudeDir: string;

	beforeEach(async () => {
		claudeDir = join(tmpdir(), `ck-mode-${Date.now()}-${Math.round(performance.now())}`);
		await mkdir(claudeDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(claudeDir, { recursive: true, force: true });
	});

	async function writeSettings(enabledPlugins: Record<string, boolean>): Promise<void> {
		await writeFile(join(claudeDir, "settings.json"), JSON.stringify({ enabledPlugins }), "utf-8");
	}

	async function writeMetadata(obj: unknown): Promise<void> {
		await writeFile(join(claudeDir, "metadata.json"), JSON.stringify(obj), "utf-8");
	}

	async function makePluginCache(marketplace: string, version: string): Promise<void> {
		await mkdir(join(claudeDir, "plugins", "cache", marketplace, "ck", version), {
			recursive: true,
		});
	}

	test("fresh: no settings, no metadata, no cache", () => {
		const report = detectInstallMode(claudeDir);
		expect(report.mode).toBe("fresh");
		expect(report.plugin.installed).toBe(false);
		expect(report.legacy.installed).toBe(false);
	});

	test("legacy: multi-kit metadata with kits.engineer", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x", files: [] } } });
		const legacy = detectLegacyState(claudeDir);
		expect(legacy.installed).toBe(true);
		expect(legacy.version).toBe("2.19.0");
		expect(detectInstallMode(claudeDir).mode).toBe("legacy");
	});

	test("legacy: single-kit format with version + files", async () => {
		await writeMetadata({
			name: "claudekit-engineer",
			version: "2.18.0",
			files: [{ path: "skills/cook/SKILL.md" }],
		});
		expect(detectLegacyState(claudeDir).installed).toBe(true);
		expect(detectInstallMode(claudeDir).mode).toBe("legacy");
	});

	test("legacy: metadata without files or engineer kit is NOT legacy", async () => {
		await writeMetadata({ name: "claudekit-engineer", version: "2.18.0" });
		expect(detectLegacyState(claudeDir).installed).toBe(false);
	});

	test("plugin: enabled via settings.enabledPlugins", async () => {
		await writeSettings({ "ck@claudekit": true });
		const plugin = detectPluginState(claudeDir);
		expect(plugin.installed).toBe(true);
		expect(plugin.enabled).toBe(true);
		expect(plugin.marketplace).toBe("claudekit");
		expect(detectInstallMode(claudeDir).mode).toBe("plugin");
	});

	test("plugin: installed but disabled (settings false)", async () => {
		await writeSettings({ "ck@claudekit": false });
		const plugin = detectPluginState(claudeDir);
		expect(plugin.installed).toBe(true);
		expect(plugin.enabled).toBe(false);
	});

	test("plugin: cache present resolves version, even without settings entry", async () => {
		await makePluginCache("claudekit", "87a174162601");
		const plugin = detectPluginState(claudeDir);
		expect(plugin.installed).toBe(true);
		expect(plugin.marketplace).toBe("claudekit");
		expect(plugin.version).toBe("87a174162601");
	});

	test("plugin: unrelated plugins do not count as ck", async () => {
		await writeSettings({ "kai@kai-personal-claude": true, "ak-core@agentkit-local": true });
		expect(detectPluginState(claudeDir).installed).toBe(false);
		expect(detectInstallMode(claudeDir).mode).toBe("fresh");
	});

	test("mixed: legacy metadata AND plugin cache present", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x" } } });
		await writeSettings({ "ck@claudekit": true });
		await makePluginCache("claudekit", "abc123def456");
		const report = detectInstallMode(claudeDir);
		expect(report.mode).toBe("mixed");
		expect(report.plugin.installed).toBe(true);
		expect(report.legacy.installed).toBe(true);
	});

	test("classifyInstallMode covers all four quadrants", () => {
		const P = (installed: boolean) => ({
			installed,
			enabled: installed,
			version: null,
			marketplace: null,
		});
		const L = (installed: boolean) => ({ installed, version: null });
		expect(classifyInstallMode(P(false), L(false))).toBe("fresh");
		expect(classifyInstallMode(P(false), L(true))).toBe("legacy");
		expect(classifyInstallMode(P(true), L(false))).toBe("plugin");
		expect(classifyInstallMode(P(true), L(true))).toBe("mixed");
	});

	test("malformed settings/metadata are treated as absent (no throw)", async () => {
		await writeFile(join(claudeDir, "settings.json"), "{ not json", "utf-8");
		await writeFile(join(claudeDir, "metadata.json"), "also not json", "utf-8");
		expect(() => detectInstallMode(claudeDir)).not.toThrow();
		expect(detectInstallMode(claudeDir).mode).toBe("fresh");
	});
});
