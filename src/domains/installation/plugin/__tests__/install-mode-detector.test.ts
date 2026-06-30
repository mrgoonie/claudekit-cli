import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	classifyInstallMode,
	detectInstallMode,
	detectLegacyState,
	detectPluginState,
	hasTrackedPluginSuppliedLegacyFiles,
	resolveInstalledPluginCacheRoot,
	resolveInstalledPluginCacheSubpath,
} from "@/domains/installation/plugin/install-mode-detector.js";

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

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

	test("plugin: orphaned cache (no settings entry) is staleCache, NOT installed", async () => {
		// uninstall removes the enabledPlugins registration but leaves the cached payload
		await makePluginCache("claudekit", "87a174162601");
		const plugin = detectPluginState(claudeDir);
		expect(plugin.installed).toBe(false);
		expect(plugin.staleCache).toBe(true);
		expect(plugin.marketplace).toBe("claudekit");
		expect(plugin.version).toBe("87a174162601");
	});

	test("legacy + orphaned plugin cache classifies as legacy (matches claude plugin list)", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x" } } });
		await makePluginCache("claudekit", "87a174162601");
		const report = detectInstallMode(claudeDir);
		expect(report.mode).toBe("legacy");
		expect(report.plugin.installed).toBe(false);
		expect(report.plugin.staleCache).toBe(true);
	});

	test("registered plugin with cache is installed, not stale", async () => {
		await writeSettings({ "ck@claudekit": true });
		await makePluginCache("claudekit", "87a174162601");
		const plugin = detectPluginState(claudeDir);
		expect(plugin.installed).toBe(true);
		expect(plugin.staleCache).toBe(false);
		expect(plugin.version).toBe("87a174162601");
	});

	test("registered plugin cache root resolves only for an installed plugin", async () => {
		await writeSettings({ "ck@claudekit": true });
		await makePluginCache("claudekit", "87a174162601");
		await mkdir(join(claudeDir, "plugins", "cache", "claudekit", "ck", "87a174162601", "agents"), {
			recursive: true,
		});

		expect(resolveInstalledPluginCacheRoot(claudeDir)).toBe(
			join(claudeDir, "plugins", "cache", "claudekit", "ck", "87a174162601"),
		);
		expect(resolveInstalledPluginCacheSubpath("agents", claudeDir)).toBe(
			join(claudeDir, "plugins", "cache", "claudekit", "ck", "87a174162601", "agents"),
		);
	});

	test("orphaned plugin cache is not used as a source root", async () => {
		await makePluginCache("claudekit", "87a174162601");
		expect(resolveInstalledPluginCacheRoot(claudeDir)).toBeNull();
		expect(resolveInstalledPluginCacheSubpath("agents", claudeDir)).toBeNull();
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

	test("detects tracked legacy agent/skill payloads that still need plugin cleanup", async () => {
		await mkdir(join(claudeDir, "agents"), { recursive: true });
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await writeFile(join(claudeDir, "agents", "planner.md"), "# planner\n", "utf-8");
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "# cook\n", "utf-8");
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					files: [
						{ path: "agents/planner.md", ownership: "ck" },
						{ path: "skills/cook/SKILL.md", ownership: "ck-modified" },
						{ path: "agents/user.md", ownership: "user" },
					],
				},
			},
		});

		expect(hasTrackedPluginSuppliedLegacyFiles(claudeDir)).toBe(true);
	});

	test("detects unmodified user-owned plugin payloads from manifestless installs", async () => {
		const skillContent = "# cook\n";
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), skillContent, "utf-8");
		await writeMetadata({
			kits: {
				engineer: {
					version: "local",
					files: [
						{
							path: "skills/cook/SKILL.md",
							ownership: "user",
							checksum: sha256(skillContent),
						},
					],
				},
			},
		});

		expect(hasTrackedPluginSuppliedLegacyFiles(claudeDir)).toBe(true);
	});

	test("ignores modified user-owned plugin payloads from manifestless installs", async () => {
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "# edited\n", "utf-8");
		await writeMetadata({
			kits: {
				engineer: {
					version: "local",
					files: [
						{
							path: "skills/cook/SKILL.md",
							ownership: "user",
							checksum: sha256("# original\n"),
						},
					],
				},
			},
		});

		expect(hasTrackedPluginSuppliedLegacyFiles(claudeDir)).toBe(false);
	});

	test("ignores unsafe tracked plugin payload paths", async () => {
		await writeFile(join(claudeDir, "settings.json"), "settings", "utf-8");
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					files: [{ path: "skills/../settings.json", ownership: "ck" }],
				},
			},
		});

		expect(hasTrackedPluginSuppliedLegacyFiles(claudeDir)).toBe(false);
	});

	test("ignores mixed installs after plugin-supplied legacy files are gone", async () => {
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					files: [{ path: "hooks/session-init.cjs", ownership: "ck" }],
				},
			},
		});

		expect(hasTrackedPluginSuppliedLegacyFiles(claudeDir)).toBe(false);
	});

	test("classifyInstallMode covers all four quadrants", () => {
		const P = (installed: boolean) => ({
			installed,
			enabled: installed,
			version: null,
			marketplace: null,
			staleCache: false,
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
