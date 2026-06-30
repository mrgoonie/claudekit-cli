import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	defaultLegacyRemover,
	migrateLegacyToPlugin,
} from "@/domains/installation/plugin/migrate-legacy-to-plugin.js";
import {
	type ClaudeRunResult,
	type ClaudeRunner,
	PluginInstaller,
} from "@/domains/installation/plugin/plugin-installer.js";

const TS = "2026-06-16T00:00:00.000Z";

function ok(stdout: string, success = true): ClaudeRunResult {
	return { ok: success, stdout, stderr: "", code: success ? 0 : 1 };
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

/** Fake installer scripted by command; records argv. */
function fakeInstaller(
	opts: {
		claudeAvailable?: boolean;
		pluginSupported?: boolean;
		verified?: boolean;
		installOk?: boolean;
		updateOk?: boolean;
		marketplaceAddOk?: boolean;
		marketplaceUpdateOk?: boolean;
		enableOk?: boolean;
	} = {},
) {
	const calls: string[][] = [];
	const runner: ClaudeRunner = async (args) => {
		calls.push(args);
		const a = args.join(" ");
		if (a === "--version") return ok("2.1.178", opts.claudeAvailable !== false);
		if (a === "plugin --help")
			return ok(opts.pluginSupported !== false ? "Manage marketplaces" : "no plugins");
		if (a === "plugin list")
			return ok(opts.verified !== false ? "ck@claudekit Status: enabled" : "No plugins installed.");
		if (a === "plugin marketplace add /src" || a === "plugin marketplace add /staged/kit")
			return ok("", opts.marketplaceAddOk !== false);
		if (a === "plugin marketplace update claudekit")
			return ok("", opts.marketplaceUpdateOk !== false);
		if (a === "plugin install ck@claudekit --scope user") return ok("", opts.installOk !== false);
		if (a === "plugin update ck") return ok("", opts.updateOk !== false);
		if (a === "plugin enable ck") return ok("", opts.enableOk !== false);
		return ok("");
	};
	return { installer: new PluginInstaller(runner), calls };
}

describe("migrateLegacyToPlugin (orchestration)", () => {
	let claudeDir: string;

	beforeEach(async () => {
		claudeDir = join(tmpdir(), `ck-migrate-${Date.now()}-${Math.round(performance.now())}`);
		await mkdir(claudeDir, { recursive: true });
	});
	afterEach(async () => {
		await rm(claudeDir, { recursive: true, force: true });
	});

	const writeMetadata = (obj: unknown) =>
		writeFile(join(claudeDir, "metadata.json"), JSON.stringify(obj), "utf-8");
	const writeSettings = (enabledPlugins: Record<string, boolean>) =>
		writeFile(join(claudeDir, "settings.json"), JSON.stringify({ enabledPlugins }), "utf-8");

	test("already plugin -> noop, no install calls", async () => {
		await writeSettings({ "ck@claudekit": true });
		const { installer, calls } = fakeInstaller();
		let removerCalled = false;
		const r = await migrateLegacyToPlugin({
			pluginSourceDir: "/src",
			claudeDir,
			installer,
			removeLegacy: () => {
				removerCalled = true;
				return [];
			},
			now: TS,
		});
		expect(r.action).toBe("noop-already-plugin");
		expect(calls.length).toBe(0);
		expect(removerCalled).toBe(false);
	});

	test("cc without plugin support -> skipped (caller falls back to legacy copy)", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x", files: [] } } });
		const { installer } = fakeInstaller({ pluginSupported: false });
		const r = await migrateLegacyToPlugin({
			pluginSourceDir: "/src",
			claudeDir,
			installer,
			removeLegacy: () => [],
			now: TS,
		});
		expect(r.action).toBe("skipped-cc-unsupported");
		expect(r.pluginVerified).toBe(false);
	});

	test("install verify fails -> install-failed, legacy NOT touched (rollback-safe ordering)", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x", files: [] } } });
		const { installer } = fakeInstaller({ verified: false });
		let removerCalled = false;
		const r = await migrateLegacyToPlugin({
			pluginSourceDir: "/src",
			claudeDir,
			installer,
			removeLegacy: () => {
				removerCalled = true;
				return [];
			},
			now: TS,
		});
		expect(r.action).toBe("install-failed");
		expect(r.pluginVerified).toBe(false);
		expect(removerCalled).toBe(false); // destructive step gated behind verify
	});

	test("fresh -> installed-fresh, no removal, receipt written", async () => {
		const { installer } = fakeInstaller();
		const r = await migrateLegacyToPlugin({
			pluginSourceDir: "/src",
			claudeDir,
			installer,
			removeLegacy: () => ["x"],
			now: TS,
		});
		expect(r.action).toBe("installed-fresh");
		expect(r.removedPaths).toEqual([]);
		expect(r.receiptPath).not.toBeNull();
		expect(existsSync(join(claudeDir, ".ck-migration-log.json"))).toBe(true);
	});

	test("legacy -> migrated, remover invoked, backup dir + receipt created", async () => {
		await writeMetadata({ kits: { engineer: { version: "2.19.0", installedAt: "x", files: [] } } });
		const { installer, calls } = fakeInstaller();
		const r = await migrateLegacyToPlugin({
			pluginSourceDir: "/staged/kit",
			claudeDir,
			installer,
			removeLegacy: () => ["skills/cook/SKILL.md"],
			now: TS,
		});
		expect(r.action).toBe("migrated-from-legacy");
		expect(r.removedPaths).toEqual(["skills/cook/SKILL.md"]);
		expect(r.backupDir).toContain("ck-legacy-");
		expect(existsSync(r.backupDir as string)).toBe(true);
		// marketplace add used the staged source dir
		expect(calls.some((c) => c.join(" ") === "plugin marketplace add /staged/kit")).toBe(true);
		const receipt = JSON.parse(readFileSync(r.receiptPath as string, "utf-8"));
		expect(receipt[0].fromMode).toBe("legacy");
		expect(receipt[0].toMode).toBe("plugin");
	});

	test("mixed already-installed plugin refreshes plugin and still cleans legacy skills", async () => {
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "legacy skill", "utf-8");
		await writeSettings({ "ck@claudekit": true });
		await writeMetadata({
			kits: {
				engineer: {
					version: "2.19.0",
					installedAt: "x",
					files: [{ path: "skills/cook/SKILL.md", ownership: "ck" }],
				},
			},
		});
		const { installer, calls } = fakeInstaller({ installOk: false, marketplaceAddOk: false });

		const r = await migrateLegacyToPlugin({
			pluginSourceDir: "/src",
			claudeDir,
			installer,
			now: TS,
		});

		expect(r.action).toBe("migrated-from-legacy");
		expect(r.removedPaths).toEqual(["skills/cook/SKILL.md"]);
		expect(existsSync(join(claudeDir, "skills", "cook", "SKILL.md"))).toBe(false);
		expect(calls).toContainEqual(["plugin", "marketplace", "update", "claudekit"]);
		expect(calls).toContainEqual(["plugin", "update", "ck"]);
		expect(calls).not.toContainEqual(["plugin", "install", "ck@claudekit", "--scope", "user"]);
	});
});

describe("defaultLegacyRemover", () => {
	let claudeDir: string;
	let backupDir: string;
	beforeEach(async () => {
		claudeDir = join(tmpdir(), `ck-rm-${Date.now()}-${Math.round(performance.now())}`);
		backupDir = join(claudeDir, "backup");
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await mkdir(join(claudeDir, "skills", "mine"), { recursive: true });
		await mkdir(backupDir, { recursive: true });
	});
	afterEach(async () => {
		await rm(claudeDir, { recursive: true, force: true });
	});

	test("removes ck-owned files, backs them up, preserves user-owned", async () => {
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "ck skill", "utf-8");
		await mkdir(join(claudeDir, "agents"), { recursive: true });
		await writeFile(join(claudeDir, "agents", "planner.md"), "ck agent", "utf-8");
		await writeFile(join(claudeDir, "skills", "mine", "SKILL.md"), "user skill", "utf-8");
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.19.0",
						installedAt: "x",
						files: [
							{ path: "skills/cook/SKILL.md", ownership: "ck" },
							{ path: "agents/planner.md", ownership: "ck" },
							{ path: "skills/mine/SKILL.md", ownership: "user" },
						],
					},
				},
			}),
			"utf-8",
		);

		const removed = defaultLegacyRemover(claudeDir, backupDir);

		expect(removed).toEqual(["skills/cook/SKILL.md", "agents/planner.md"]);
		expect(existsSync(join(claudeDir, "skills", "cook", "SKILL.md"))).toBe(false); // ck removed
		expect(existsSync(join(claudeDir, "agents", "planner.md"))).toBe(false); // ck removed
		expect(existsSync(join(claudeDir, "skills", "mine", "SKILL.md"))).toBe(true); // user preserved
		expect(existsSync(join(backupDir, "skills", "cook", "SKILL.md"))).toBe(true); // backed up
		expect(existsSync(join(backupDir, "agents", "planner.md"))).toBe(true); // backed up
	});

	test("removes unmodified plugin-supplied files marked user-owned by manifestless installs", async () => {
		const skillContent = "offline skill";
		const agentContent = "offline agent";
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), skillContent, "utf-8");
		await mkdir(join(claudeDir, "agents"), { recursive: true });
		await writeFile(join(claudeDir, "agents", "planner.md"), agentContent, "utf-8");
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "local",
						installedAt: "x",
						files: [
							{
								path: "skills/cook/SKILL.md",
								ownership: "user",
								checksum: sha256(skillContent),
							},
							{
								path: "agents/planner.md",
								ownership: "user",
								checksum: sha256(agentContent),
							},
						],
					},
				},
			}),
			"utf-8",
		);

		const removed = defaultLegacyRemover(claudeDir, backupDir);

		expect(removed).toEqual(["skills/cook/SKILL.md", "agents/planner.md"]);
		expect(existsSync(join(claudeDir, "skills", "cook", "SKILL.md"))).toBe(false);
		expect(existsSync(join(claudeDir, "agents", "planner.md"))).toBe(false);
		expect(existsSync(join(backupDir, "skills", "cook", "SKILL.md"))).toBe(true);
		expect(existsSync(join(backupDir, "agents", "planner.md"))).toBe(true);
	});

	test("removes orphaned legacy sentinels after plugin-supplied files are removed", async () => {
		await mkdir(join(claudeDir, "skills", "cook", "scripts"), { recursive: true });
		await writeFile(join(claudeDir, "skills", ".gitignore"), "sentinel", "utf-8");
		await writeFile(
			join(claudeDir, "skills", "cook", "scripts", ".gitignore"),
			"sentinel",
			"utf-8",
		);
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "ck skill", "utf-8");
		await writeFile(join(claudeDir, "skills", "cook", "scripts", "tool.js"), "tool", "utf-8");
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.19.0",
						installedAt: "x",
						files: [
							{ path: "skills/cook/SKILL.md", ownership: "ck" },
							{ path: "skills/cook/scripts/tool.js", ownership: "ck" },
						],
					},
				},
			}),
			"utf-8",
		);

		const removed = defaultLegacyRemover(claudeDir, backupDir);

		expect(removed).toEqual([
			"skills/cook/SKILL.md",
			"skills/cook/scripts/tool.js",
			"skills/.gitignore",
			"skills/cook/scripts/.gitignore",
		]);
		expect(existsSync(join(claudeDir, "skills", ".gitignore"))).toBe(false);
		expect(existsSync(join(claudeDir, "skills", "cook", "scripts", ".gitignore"))).toBe(false);
		expect(existsSync(join(backupDir, "skills", ".gitignore"))).toBe(true);
		expect(existsSync(join(backupDir, "skills", "cook", "scripts", ".gitignore"))).toBe(true);
	});

	test("preserves legacy sentinels when user content remains in the same subtree", async () => {
		await writeFile(join(claudeDir, "skills", ".gitignore"), "sentinel", "utf-8");
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "ck skill", "utf-8");
		await writeFile(join(claudeDir, "skills", "mine", "SKILL.md"), "user skill", "utf-8");
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.19.0",
						installedAt: "x",
						files: [
							{ path: "skills/cook/SKILL.md", ownership: "ck" },
							{ path: "skills/mine/SKILL.md", ownership: "user" },
						],
					},
				},
			}),
			"utf-8",
		);

		const removed = defaultLegacyRemover(claudeDir, backupDir);

		expect(removed).toEqual(["skills/cook/SKILL.md"]);
		expect(existsSync(join(claudeDir, "skills", ".gitignore"))).toBe(true);
		expect(existsSync(join(claudeDir, "skills", "mine", "SKILL.md"))).toBe(true);
		expect(existsSync(join(backupDir, "skills", ".gitignore"))).toBe(false);
	});

	test("preserves modified user-owned plugin-supplied files", async () => {
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "edited skill", "utf-8");
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "local",
						installedAt: "x",
						files: [
							{
								path: "skills/cook/SKILL.md",
								ownership: "user",
								checksum: sha256("original skill"),
							},
						],
					},
				},
			}),
			"utf-8",
		);

		const removed = defaultLegacyRemover(claudeDir, backupDir);

		expect(removed).toEqual([]);
		expect(existsSync(join(claudeDir, "skills", "cook", "SKILL.md"))).toBe(true);
		expect(existsSync(join(backupDir, "skills", "cook", "SKILL.md"))).toBe(false);
	});

	test("preserves runtime files that the plugin format does not supply yet", async () => {
		await mkdir(join(claudeDir, "hooks"), { recursive: true });
		await mkdir(join(claudeDir, "rules"), { recursive: true });
		await mkdir(join(claudeDir, "skills", "cook"), { recursive: true });
		await writeFile(join(claudeDir, "hooks", "session-init.cjs"), "hook", "utf-8");
		await writeFile(join(claudeDir, "rules", "team.md"), "rules", "utf-8");
		await writeFile(join(claudeDir, "statusline.cjs"), "status", "utf-8");
		await writeFile(join(claudeDir, "skills", "cook", "SKILL.md"), "skill", "utf-8");
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.19.0",
						installedAt: "x",
						files: [
							{ path: "hooks/session-init.cjs", ownership: "ck" },
							{ path: "rules/team.md", ownership: "ck" },
							{ path: "statusline.cjs", ownership: "ck" },
							{ path: "skills/cook/SKILL.md", ownership: "ck" },
						],
					},
				},
			}),
			"utf-8",
		);

		const removed = defaultLegacyRemover(claudeDir, backupDir);

		expect(removed).toEqual(["skills/cook/SKILL.md"]);
		expect(existsSync(join(claudeDir, "skills", "cook", "SKILL.md"))).toBe(false);
		expect(existsSync(join(claudeDir, "hooks", "session-init.cjs"))).toBe(true);
		expect(existsSync(join(claudeDir, "rules", "team.md"))).toBe(true);
		expect(existsSync(join(claudeDir, "statusline.cjs"))).toBe(true);
		expect(existsSync(join(backupDir, "hooks", "session-init.cjs"))).toBe(false);
	});

	test("multi-kit: removes ONLY engineer kit files, never another kit's files", async () => {
		await mkdir(join(claudeDir, "skills", "engskill"), { recursive: true });
		await mkdir(join(claudeDir, "skills", "mktskill"), { recursive: true });
		await writeFile(join(claudeDir, "skills", "engskill", "SKILL.md"), "eng", "utf-8");
		await writeFile(join(claudeDir, "skills", "mktskill", "SKILL.md"), "mkt", "utf-8");
		await writeFile(
			join(claudeDir, "metadata.json"),
			JSON.stringify({
				kits: {
					engineer: {
						version: "2.19.0",
						installedAt: "x",
						files: [{ path: "skills/engskill/SKILL.md", ownership: "ck" }],
					},
					marketing: {
						version: "1.0.0",
						installedAt: "x",
						files: [{ path: "skills/mktskill/SKILL.md", ownership: "ck" }],
					},
				},
			}),
			"utf-8",
		);

		const removed = defaultLegacyRemover(claudeDir, backupDir);

		expect(removed).toEqual(["skills/engskill/SKILL.md"]); // engineer only
		expect(existsSync(join(claudeDir, "skills", "engskill", "SKILL.md"))).toBe(false);
		expect(existsSync(join(claudeDir, "skills", "mktskill", "SKILL.md"))).toBe(true); // marketing untouched
	});
});
