import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginInstallModeChecker } from "@/domains/health-checks/plugin-install-mode-checker.js";
import type { CodexPluginState } from "@/domains/installation/plugin/codex-plugin-installer.js";

const codexUnavailable: CodexPluginState = {
	status: "codex-unavailable",
	pluginId: "ck@claudekit",
	enabled: false,
	installed: false,
	installedVersion: null,
	expectedVersion: null,
	marketplace: null,
	expectedMarketplace: "claudekit",
	source: null,
	expectedSource: null,
	shouldRefresh: false,
};

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

	async function single(codexState: CodexPluginState = codexUnavailable) {
		const results = await new PluginInstallModeChecker(claudeDir, {
			detectCodexPluginState: async () => codexState,
		}).run();
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
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "# cook\n", "utf-8");
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					installedAt: "x",
					files: [{ path: "skills/cook/SKILL.md", ownership: "ck" }],
				},
			},
		});
		const r = await single();
		expect(r.status).toBe("pass");
		expect(r.message).toContain("legacy");
		expect(r.message).toContain("2.19.0");
	});

	test("reports persisted install mode preference", async () => {
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					installedAt: "x",
					installModePreference: "legacy",
				},
			},
		});
		const r = await single();
		expect(r.message).toContain("preference: legacy (normal skills)");
	});

	test("persisted plugin consent with enabled plugin -> pass", async () => {
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					installedAt: "x",
					installModePreference: "plugin",
				},
			},
		});
		await writeSettings({ "ck@claudekit": true });
		const r = await single();
		expect(r.status).toBe("pass");
		expect(r.message.toLowerCase()).toContain("plugin");
		expect(r.message).toContain("enabled");
	});

	test("persisted plugin consent with disabled plugin -> warn with enable hint", async () => {
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					installedAt: "x",
					installModePreference: "plugin",
				},
			},
		});
		await writeSettings({ "ck@claudekit": false });
		const r = await single();
		expect(r.status).toBe("warn");
		expect(r.message).toContain("claude plugin enable ck");
	});

	test("disabled plugin without consent recommends normal cleanup instead of enablement", async () => {
		await writeMetadata({
			kits: { engineer: { version: "2.19.0", installedAt: "x" } },
		});
		await writeSettings({ "ck@claudekit": false });

		const r = await single();

		expect(r.status).toBe("warn");
		expect(r.message).toContain("--install-mode legacy");
		expect(r.message).not.toContain("claude plugin enable ck");
	});

	test("mixed without plugin consent -> warn with normal convergence guidance", async () => {
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "# cook\n", "utf-8");
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					installedAt: "x",
					files: [{ path: "skills/cook/SKILL.md", ownership: "ck" }],
				},
			},
		});
		await writeSettings({ "ck@claudekit": true });
		const r = await single();
		expect(r.status).toBe("warn");
		expect(r.message).toContain("mixed");
		expect(r.message).toContain("--install-mode legacy");
	});

	test("warns when Codex plugin is stale for persisted plugin consent", async () => {
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.20.1-beta.7",
					installedAt: "x",
					installModePreference: "plugin",
				},
			},
		});
		await writeSettings({ "ck@claudekit": true });

		const r = await single({
			...codexUnavailable,
			status: "installed-stale-version",
			installed: true,
			enabled: true,
			installedVersion: "2.20.1-beta.6",
			expectedVersion: "2.20.1-beta.7",
			shouldRefresh: true,
		});

		expect(r.status).toBe("warn");
		expect(r.message).toContain("Codex plugin requires refresh");
		expect(r.message).toContain("Codex plugin: installed-stale-version, 2.20.1-beta.6");
	});

	test.each([undefined, "auto", "unexpected"])(
		"plugin state with non-consenting preference %p recommends normal convergence",
		async (preference) => {
			await writeMetadata({
				kits: {
					engineer: {
						version: "2.19.0",
						installedAt: "x",
						...(preference === undefined ? {} : { installModePreference: preference }),
					},
				},
			});
			await writeSettings({ "ck@claudekit": true });

			const r = await single();

			expect(r.status).toBe("warn");
			expect(r.message).toContain("--install-mode legacy");
			expect(r.message).not.toContain("claude plugin enable ck");
		},
	);

	test("passes expected kit version and source to Codex state detection", async () => {
		await writeSettings({ "ck@claudekit": true });
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.20.1-beta.7",
					installedAt: "x",
					installModePreference: "plugin",
				},
			},
		});

		const seen: unknown[] = [];
		const results = await new PluginInstallModeChecker(claudeDir, {
			detectCodexPluginState: async (options) => {
				seen.push(options);
				return codexUnavailable;
			},
		}).run();

		expect(results[0].status).toBe("pass");
		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({
			expectedVersion: "2.20.1-beta.7",
			expectedMarketplace: "claudekit",
		});
		expect((seen[0] as { expectedSource?: string }).expectedSource).toContain("ck-plugin-source");
	});

	test("warns when legacy preference still has an active Codex plugin", async () => {
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					installedAt: "x",
					installModePreference: "legacy",
				},
			},
		});

		const r = await single({
			...codexUnavailable,
			status: "installed-current",
			installed: true,
			enabled: true,
			shouldRefresh: false,
		});

		expect(r.status).toBe("warn");
		expect(r.message).toContain("preference is legacy (normal skills)");
	});
});
