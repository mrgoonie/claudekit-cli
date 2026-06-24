import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	handlePluginInstall,
	stagePluginSource,
} from "@/commands/init/phases/plugin-install-handler.js";
import type { InitContext } from "@/commands/init/types.js";
import type { CodexPluginInstallResult } from "@/domains/installation/plugin/codex-plugin-installer.js";
import type { MigrateResult } from "@/domains/installation/plugin/migrate-legacy-to-plugin.js";

const okResult: MigrateResult = {
	action: "installed-fresh",
	modeBefore: "fresh",
	pluginVerified: true,
	backupDir: null,
	removedPaths: [],
	receiptPath: null,
};
const okCodexResult: CodexPluginInstallResult = {
	action: "installed",
	pluginVerified: true,
};

describe("handlePluginInstall (init Phase 7.5)", () => {
	let root: string;
	let extractDir: string;
	let claudeDir: string;
	let stageBase: string;

	beforeEach(async () => {
		root = join(tmpdir(), `ck-pih-${Date.now()}-${Math.round(performance.now())}`);
		extractDir = join(root, "extract");
		claudeDir = join(root, "claude");
		stageBase = join(root, "stage");
		await mkdir(join(extractDir, ".claude", ".claude-plugin"), { recursive: true });
		await mkdir(join(extractDir, ".claude", "skills", "cook"), { recursive: true });
		await writeFile(
			join(extractDir, ".claude", ".claude-plugin", "plugin.json"),
			'{"name":"ck"}',
			"utf-8",
		);
		await mkdir(claudeDir, { recursive: true });
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	function ctxOf(over: Partial<{ kitType: string; global: boolean }> = {}): InitContext {
		return {
			kitType: over.kitType ?? "engineer",
			options: { global: over.global ?? true },
			extractDir,
			claudeDir,
		} as unknown as InitContext;
	}

	test("non-engineer kit: skips (migrate not called)", async () => {
		let called = false;
		await handlePluginInstall(ctxOf({ kitType: "marketing" }), {
			migrate: async () => {
				called = true;
				return okResult;
			},
			stageBaseDir: stageBase,
		});
		expect(called).toBe(false);
	});

	test("local (non-global) install: skips", async () => {
		let called = false;
		await handlePluginInstall(ctxOf({ global: false }), {
			migrate: async () => {
				called = true;
				return okResult;
			},
			stageBaseDir: stageBase,
		});
		expect(called).toBe(false);
	});

	test("engineer + global: stages source and installs Claude and Codex plugins", async () => {
		const calls: Array<{ pluginSourceDir: string; claudeDir?: string }> = [];
		const codexCalls: string[] = [];
		await handlePluginInstall(ctxOf(), {
			migrate: async (o) => {
				calls.push({ pluginSourceDir: o.pluginSourceDir, claudeDir: o.claudeDir });
				return okResult;
			},
			installCodex: async (o) => {
				codexCalls.push(o.pluginSourceDir);
				return okCodexResult;
			},
			stageBaseDir: stageBase,
		});
		expect(calls).toHaveLength(1);
		expect(calls[0].claudeDir).toBe(claudeDir);
		expect(calls[0].pluginSourceDir).toBe(stageBase);
		expect(codexCalls).toEqual([stageBase]);
		// staged payload + synthesized marketplace exist
		expect(existsSync(join(stageBase, ".claude", ".claude-plugin", "plugin.json"))).toBe(true);
		expect(existsSync(join(stageBase, ".claude", ".codex-plugin", "plugin.json"))).toBe(true);
		expect(existsSync(join(stageBase, ".claude-plugin", "marketplace.json"))).toBe(true);
		expect(existsSync(join(stageBase, ".agents", "plugins", "marketplace.json"))).toBe(true);
	});

	test("migrate throwing never fails init (legacy copy retained)", async () => {
		const ctx = ctxOf();
		const out = await handlePluginInstall(ctx, {
			migrate: async () => {
				throw new Error("boom");
			},
			stageBaseDir: stageBase,
		});
		expect(out).toBe(ctx); // returns context, no throw
	});
});

describe("stagePluginSource", () => {
	let root: string;
	beforeEach(async () => {
		root = join(tmpdir(), `ck-stage-${Date.now()}-${Math.round(performance.now())}`);
		await mkdir(join(root, "extract", ".claude", ".claude-plugin"), { recursive: true });
		await writeFile(
			join(root, "extract", ".claude", ".claude-plugin", "plugin.json"),
			'{"name":"ck"}',
			"utf-8",
		);
	});
	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("copies .claude payload and writes Claude and Codex marketplace files", () => {
		const base = join(root, "stage");
		const result = stagePluginSource(join(root, "extract"), base);
		expect(result).toBe(base);
		expect(existsSync(join(base, ".claude", ".claude-plugin", "plugin.json"))).toBe(true);
		expect(existsSync(join(base, ".claude", ".codex-plugin", "plugin.json"))).toBe(true);
		const claudeMarketplace = JSON.parse(
			readFileSync(join(base, ".claude-plugin", "marketplace.json"), "utf-8"),
		);
		expect(claudeMarketplace.plugins[0].name).toBe("ck");
		expect(claudeMarketplace.plugins[0].source).toBe("./.claude");
		const codexMarketplace = JSON.parse(
			readFileSync(join(base, ".agents", "plugins", "marketplace.json"), "utf-8"),
		);
		expect(codexMarketplace.plugins[0].name).toBe("ck");
		expect(codexMarketplace.plugins[0].source.path).toBe("./.claude");
		expect(codexMarketplace.plugins[0].policy.installation).toBe("AVAILABLE");
	});

	test("throws when archive has no .claude payload", () => {
		expect(() => stagePluginSource(join(root, "nonexistent"), join(root, "stage2"))).toThrow();
	});
});
